import { useState, useRef, useEffect, createElement } from "react";

// ─── SUPABASE ────────────────────────────────────────────────────────────────

const SUPA_URL = "https://ojslewybmcayfmvuhqsc.supabase.co";
const SUPA_KEY = "sb_publishable_JmENOILK3rOPz9-0IqcA1A_1or2An5-";

// ─── HAVERSINE — distancia entre dos coordenadas en km ───────────────────────
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const supa = {
  headers: { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY },

  async signUpEmail(email, password) {
    const r = await fetch(SUPA_URL + "/auth/v1/signup", {
      method: "POST", headers: this.headers,
      body: JSON.stringify({ email, password })
    });
    return r.json();
  },

  async signInEmail(email, password) {
    const r = await fetch(SUPA_URL + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: this.headers,
      body: JSON.stringify({ email, password })
    });
    return r.json();
  },

  async signInMagicLink(email) {
    const r = await fetch(SUPA_URL + "/auth/v1/otp", {
      method: "POST", headers: this.headers,
      body: JSON.stringify({ email, create_user: true })
    });
    return r.json();
  },

  signInGoogle() {
    const redirectTo = encodeURIComponent(window.location.href);
    window.location.href = SUPA_URL + "/auth/v1/authorize?provider=google&redirect_to=" + redirectTo;
  },

  async getSessionFromURL() {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const token = params.get("access_token");
      if (token) {
        window.history.replaceState(null, "", window.location.pathname);
        try {
          const user = await this.getUser(token);
          if (user && user.id) return { token, user, email: user.email };
        } catch(e) {}
      }
    }
    return null;
  },

  saveSession(session) {
    try { localStorage.setItem("safy_session", JSON.stringify(session)); } catch(e) {}
  },

  clearSession() {
    try { localStorage.removeItem("safy_session"); } catch(e) {}
  },

  async getUser(token) {
    const r = await fetch(SUPA_URL + "/auth/v1/user", {
      headers: { ...this.headers, "Authorization": "Bearer " + token }
    });
    return r.json();
  },

  async upsertProfile(token, profile) {
    const {id, ...data} = profile;
    console.log("upsertProfile — userId:", id, "token:", token?.slice(0,20));
    // Usar PATCH para actualizar el perfil existente (creado por trigger)
    const r = await fetch(SUPA_URL + "/rest/v1/profiles?id=eq." + id, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + token,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(data)
    });
    const text = await r.text();
    console.log("upsertProfile PATCH — status:", r.status, "body:", text.slice(0,200));
    if(!r.ok) {
      // Si el PATCH falla, intentar POST
      console.log("PATCH falló, intentando POST...");
      const r2 = await fetch(SUPA_URL + "/rest/v1/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPA_KEY,
          "Authorization": "Bearer " + token,
          "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({id, ...data})
      });
      const text2 = await r2.text();
      console.log("POST fallback — status:", r2.status, "body:", text2.slice(0,200));
      if(!r2.ok) return {error: text2};
    }
    return {data: true};
  },

  async getProfile(token, userId) {
    const r = await fetch(SUPA_URL + "/rest/v1/profiles?id=eq." + userId + "&select=*", {
      headers: { ...this.headers, "Authorization": "Bearer " + token }
    });
    // Token inválido o expirado — limpiar sesión
    if(r.status === 401 || r.status === 403) {
      this.clearSession();
      return null;
    }
    const d = await r.json();
    // Si devuelve error de Supabase (usuario eliminado, etc)
    if(d && d.code) { this.clearSession(); return null; }
    return Array.isArray(d) ? (d[0] || null) : null;
  },

  async getProfiles(token, rolUsuario) {
    const targetRol = rolUsuario === "empresa" ? "profesional" : "empresa";
    const r = await fetch(
      SUPA_URL + "/rest/v1/profiles?rol=eq." + targetRol + "&select=*&order=created_at.desc&limit=50",
      { headers: { ...this.headers, "Authorization": "Bearer " + (token || SUPA_KEY) } }
    );
    if(!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  },

  async getJobs(token) {
    const r = await fetch(SUPA_URL + "/rest/v1/jobs?select=*&order=created_at.desc", {
      headers: { ...this.headers, "Authorization": "Bearer " + (token || SUPA_KEY) }
    });
    return r.json();
  },

  async createJob(token, job) {
    const r = await fetch(SUPA_URL + "/rest/v1/jobs", {
      method: "POST",
      headers: { ...this.headers, "Authorization": "Bearer " + token, "Prefer": "return=representation" },
      body: JSON.stringify(job)
    });
    return r.json();
  },

  async recordSwipe(token, userId, targetId, dir) {
    await fetch(SUPA_URL + "/rest/v1/swipes", {
      method: "POST",
      headers: { ...this.headers, "Authorization": "Bearer " + token },
      body: JSON.stringify({ user_id: userId, target_id: String(targetId), direccion: dir })
    });
  },

  async recordMatch(token, userId, targetId) {
    await fetch(SUPA_URL + "/rest/v1/matches", {
      method: "POST",
      headers: { ...this.headers, "Authorization": "Bearer " + token },
      body: JSON.stringify({ user1_id: userId, user2_id: String(targetId) })
    });
  },
};

// ─── DATOS ───────────────────────────────────────────────────────────────────

const TITULOS = {
  est:"Estudiante SyH", tec:"Técnico SyH", lic:"Licenciado SyH", ing:"Ingeniero SyH",
  est_syh:"Estudiante SyH", tec_syh:"Técnico SyH", lic_syh:"Licenciado SyH",
  ing_syh:"Ingeniero SyH", aud_syh:"Auditor SyH",
  est_ma:"Estudiante MA", tec_ma:"Técnico MA", lic_ma:"Lic. C. Ambientales",
  ing_ma:"Ing. Ambiental", gest_ma:"Gestor Ambiental", aud_ma:"Auditor Ambiental",
  no_aplica:"No aplica",
  osha30_con:"OSHA 30 — Construcción",
  osha30_ind:"OSHA 30 — Industria General",
  iso45001:"Specialist ISO 45001",
};

const TERMINOS = {
  AR:{disciplina:"Seguridad e Higiene en el Trabajo",abrev:"SyH"},
  UY:{disciplina:"Seguridad e Higiene en el Trabajo",abrev:"SyH"},
  PY:{disciplina:"Seguridad e Higiene en el Trabajo",abrev:"SyH"},
  ES:{disciplina:"Prevención de Riesgos Laborales",abrev:"PRL"},
  MX:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
  CO:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
  PE:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
  BO:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
  EC:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
  VE:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
  CL:{disciplina:"Seguridad y Salud Ocupacional",abrev:"SSO"},
  BR:{disciplina:"Segurança e Saúde Ocupacional",abrev:"SSO"},
  US:{disciplina:"Seguridad y Salud Ocupacional",abrev:"SSO"},
  default:{disciplina:"Seguridad y Salud en el Trabajo",abrev:"SST"},
};
const getT = (p) => TERMINOS[p] || TERMINOS.default;

const getSeguro = (pais) => {
  const m = {
    AR:"Seguro de Accidentes Personales (SAP)",
    UY:"Seguro de Accidentes Personales (SAP)",
    PY:"Seguro de Accidentes Personales (SAP)",
    BR:"Seguro de Acidente Pessoal (SAP)",
    ES:"Seguro de Accidentes Laborales",
    MX:"Seguro de Accidentes de Trabajo (SAT)",
    CO:"Seguro de Accidentes de Trabajo (SAT)",
    PE:"Seguro de Accidentes de Trabajo (SAT)",
    BO:"Seguro de Accidentes de Trabajo (SAT)",
    EC:"Seguro de Accidentes de Trabajo (SAT)",
    VE:"Seguro de Accidentes de Trabajo (SAT)",
    CL:"Seguro de Accidentes del Trabajo",
    US:"Workers Compensation / Personal Accident Insurance",
  };
  return m[pais] || "Seguro de Accidentes Personales";
};

const PAISES = [
  {v:"AR",l:"Argentina"},{v:"MX",l:"México"},{v:"CO",l:"Colombia"},
  {v:"CL",l:"Chile"},{v:"PE",l:"Perú"},{v:"UY",l:"Uruguay"},
  {v:"PY",l:"Paraguay"},{v:"BO",l:"Bolivia"},{v:"EC",l:"Ecuador"},
  {v:"VE",l:"Venezuela"},{v:"BR",l:"Brasil"},{v:"ES",l:"España"},
  {v:"US",l:"Estados Unidos"},{v:"otro",l:"Otro"},
];

const PROVINCIAS = {
  AR:["Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
      "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
      "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz",
      "Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"],
  ES:["Andalucía","Aragón","Asturias","Baleares","Canarias","Cantabria",
      "Castilla-La Mancha","Castilla y León","Cataluña","Extremadura",
      "Galicia","La Rioja","Madrid","Murcia","Navarra","País Vasco","Valencia"],
  MX:["Ciudad de México","Jalisco","Nuevo León","Puebla","Guanajuato",
      "Veracruz","Estado de México","Chihuahua","Sonora","Coahuila","Otro"],
  CO:["Bogotá D.C.","Antioquia","Valle del Cauca","Cundinamarca","Atlántico",
      "Santander","Bolívar","Nariño","Córdoba","Tolima","Otro"],
  CL:["Región Metropolitana","Valparaíso","Biobío","Araucanía","Maule",
      "Los Lagos","Coquimbo","O'Higgins","Antofagasta","Tarapacá","Otro"],
  PE:["Lima","Arequipa","La Libertad","Piura","Cusco","Junín","Lambayeque",
      "Áncash","Loreto","Cajamarca","Otro"],
  default:[],
};

const SKILLS = [
  "Trabajo en Altura","Espacios Confinados","Riesgo Eléctrico","NFPA 70E",
  "ISO 45001","Ergonomía","Capacitaciones","Haz-Mat","Primeros Auxilios",
  "IRAM","Auditorías","Manejo de EPP","Gestión de Emergencias","Inglés",
  "Res. Peligrosos","Arc Flash","LOTO","Análisis de Riesgos","APT / ART",
  "Permisos de Trabajo","Seguridad Vial","Extinción de Incendios",
  "ISO 14001","Evaluación de Impacto Ambiental","Gestión de Residuos",
  "Auditoría Ambiental","Monitoreo Ambiental","Huella de Carbono",
  "Sustentabilidad","Legislación Ambiental",
];

const SECTORES = [
  "Construcción","Industria Petroquímica","Minería","Industria Vial",
  "Farmacéutica","Alimentaria","Metalúrgica","Energía / Oil & Gas",
  "Logística","Hospitales / Salud","Manufactura","Agro / Agroindustria",
  "Gestión Ambiental","Energías Renovables","Consultoría Ambiental",
  "Consultoría SyH / HSE","Agua y Saneamiento","Otro",
];

const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const ADMIN_CODE = "safy2025";

const profesionales = [
  {id:1,nombre:"Carla",apellido:"Méndez",titulo:"lic",ciudad:"Buenos Aires",pais:"AR",
   distancia:3,tarifa:2800,moneda:"ARS",disponible:true,
   perfil:"8 años en obra civil y plantas industriales. Especialidad en altura y espacios confinados.",
   obras:["Torre Catalinas Norte","Planta YPF Ensenada"],
   avatar:"CM",color:"#E63946",skills:["Trabajo en Altura","NFPA 70E","Ergonomía"],
   rating:4.8,trabajos:34,email:"carla.mendez@gmail.com",tel:"+54 9 11 4421-0033"},
  {id:2,nombre:"Roberto",apellido:"Funes",titulo:"tec",ciudad:"Rosario",pais:"AR",
   distancia:12,tarifa:1900,moneda:"ARS",disponible:true,
   perfil:"6 años en obras viales y minería. Manejo de explosivos certificado.",
   obras:["Ruta Nacional 9","Viaducto Mendoza"],
   avatar:"RF",color:"#2A9D8F",skills:["Seguridad Vial","Análisis de Riesgos"],
   rating:4.6,trabajos:21,email:"rfunes@gmail.com",tel:"+54 9 341 558-2290"},
  {id:3,nombre:"Sofía",apellido:"Peralta",titulo:"ing",ciudad:"Córdoba",pais:"AR",
   distancia:7,tarifa:35,moneda:"USD",disponible:false,
   perfil:"12 años. Especialista en riesgo eléctrico y auditorías. Certificada IRAM.",
   obras:["EPEC Central Térmica","Volkswagen Pacheco"],
   avatar:"SP",color:"#7B2D8B",skills:["Riesgo Eléctrico","ISO 45001","Auditorías"],
   rating:4.9,trabajos:57,email:"sofia.peralta@gmail.com",tel:"+54 9 351 442-1100"},
  {id:4,nombre:"Diego",apellido:"Acuña",titulo:"tec",ciudad:"Mendoza",pais:"AR",
   distancia:5,tarifa:2100,moneda:"ARS",disponible:true,
   perfil:"4 años en industria vitivinícola. Certificado HACCP.",
   obras:["Bodega Catena Zapata","Planta Nestlé"],
   avatar:"DA",color:"#F4A261",skills:["Ergonomía","Capacitaciones"],
   rating:4.4,trabajos:18,email:"diegoacuna@gmail.com",tel:"+54 9 261 334-7788"},
  {id:5,nombre:"Valeria",apellido:"Sosa",titulo:"lic",ciudad:"La Plata",pais:"AR",
   distancia:9,tarifa:2600,moneda:"ARS",disponible:true,
   perfil:"7 años en infraestructura y hospitales. Especialista en residuos peligrosos.",
   obras:["Hospital El Cruce","Puerto La Plata"],
   avatar:"VS",color:"#264653",skills:["Res. Peligrosos","Gestión de Emergencias"],
   rating:4.7,trabajos:29,email:"valeria.sosa@gmail.com",tel:"+54 9 221 445-9922"},
];

const OBRAS_SEED = [
  {id:101,empresa:"Constructora Omega S.A.",tipo:"Obra civil",ciudad:"Buenos Aires",
   distancia:2,presupuesto:3200,moneda:"ARS",duracion:"3 meses",urgente:true,
   descripcion:"Torre de 22 pisos en Palermo. Programa de seguridad, recorridas y APT.",
   requisitos:["Licenciado o Técnico","Exp. en altura"],
   avatar:"CO",color:"#E63946",email:"rrhh@omega.com.ar",tel:"+54 11 4800-0000"},
  {id:102,empresa:"Petroquímica del Sur",tipo:"Industria petroquímica",ciudad:"Bahía Blanca",
   distancia:14,presupuesto:4100,moneda:"ARS",duracion:"6 meses",urgente:false,
   descripcion:"Planta de refinación. Programa anual y gestión de emergencias.",
   requisitos:["Ingeniero o Licenciado","NFPA"],
   avatar:"PS",color:"#2A9D8F",email:"seguridad@petrosur.com",tel:"+54 291 4500-100"},
  {id:103,empresa:"Vial Patagónica SA",tipo:"Obra vial",ciudad:"Neuquén",
   distancia:22,presupuesto:2700,moneda:"ARS",duracion:"4 meses",urgente:true,
   descripcion:"Pavimentación Ruta 22. Programa de Seguridad y supervisión diaria.",
   requisitos:["Técnico o Licenciado","Exp. vial"],
   avatar:"VP",color:"#F4A261",email:"obras@vialpatagonicasa.com",tel:"+54 299 4400-200"},
  {id:104,empresa:"Laboratorios Biol",tipo:"Industria farmacéutica",ciudad:"Buenos Aires",
   distancia:6,presupuesto:40,moneda:"USD",duracion:"Indefinido",urgente:false,
   descripcion:"Relación de dependencia. Gestión integral SyH, ISO 45001 y auditorías.",
   requisitos:["Licenciado o Ingeniero","ISO 45001"],
   avatar:"LB",color:"#7B2D8B",email:"rrhh@biol.com",tel:"+54 11 5200-8800"},
];

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
@keyframes fadeUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes popIn{from{transform:scale(.88);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes sZoom{0%{transform:scale(4.5);opacity:0}40%{opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes slideInLeft{from{transform:translateX(-18px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes yBounce{0%{transform:translateY(14px) scale(.7);opacity:0}60%{transform:translateY(-4px) scale(1.08);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes fadeInTag{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes dotPulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
*{box-sizing:border-box}
body,button,input,select,textarea{font-family:'DM Sans','Inter',system-ui,sans-serif}
::-webkit-scrollbar{display:none}
input[type=range]{accent-color:#1a1a2e}
`;

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────

const Av = ({init,color,size=48,foto}) =>
  foto
    ? <img src={foto} alt={init} style={{
        width:size, height:size, borderRadius:"50%",
        objectFit:"cover", objectPosition:"center",
        flexShrink:0, display:"block",
        border:"none", background:color||"#1a1a2e"
      }}/>
    : <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0,
        display:"flex",alignItems:"center",justifyContent:"center",
        color:"#fff",fontWeight:700,fontSize:size*.32}}>{init}</div>;

const Chip = ({children,selected,onClick,color="#1a1a2e"}) => (
  <span onClick={onClick} style={{padding:"5px 12px",borderRadius:99,fontSize:12,fontWeight:600,
    color:selected?"#fff":color,background:selected?color:"#f0f0f8",
    border:"1.5px solid "+(selected?color:"transparent"),
    cursor:onClick?"pointer":"default",userSelect:"none",display:"inline-block"}}>
    {children}
  </span>
);

const Inp = ({label,hint,optional,value,onChange,...rest}) => (
  <div style={{marginBottom:18}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{label}</label>
      {optional&&<span style={{fontSize:11,color:"#aaa"}}>Opcional</span>}
    </div>
    {hint&&<div style={{fontSize:12,color:"#888",marginBottom:6}}>{hint}</div>}
    <input value={value||""} onChange={e=>onChange&&onChange(e.target.value)} {...rest}
      style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",
        fontSize:14,color:"#1a1a2e",outline:"none",background:"#fff",boxSizing:"border-box"}}/>
  </div>
);

const Sel = ({label,hint,optional,options,value,onChange}) => (
  <div style={{marginBottom:18}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{label}</label>
      {optional&&<span style={{fontSize:11,color:"#aaa"}}>Opcional</span>}
    </div>
    {hint&&<div style={{fontSize:12,color:"#888",marginBottom:6}}>{hint}</div>}
    <select value={value||""} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",
        fontSize:14,color:value?"#1a1a2e":"#aaa",outline:"none",background:"#fff",
        appearance:"none",WebkitAppearance:"none",boxSizing:"border-box",
        backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")",
        backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center"}}>
      {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

const Txt = ({label,hint,optional,example,value,onChange}) => (
  <div style={{marginBottom:18}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{label}</label>
      {optional&&<span style={{fontSize:11,color:"#aaa"}}>Opcional</span>}
    </div>
    {hint&&<div style={{fontSize:12,color:"#888",marginBottom:6}}>{hint}</div>}
    <textarea rows={4} value={value||""} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",
        fontSize:14,color:"#1a1a2e",outline:"none",background:"#fff",resize:"vertical",
        boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit"}}/>
    {example&&<div style={{marginTop:8,background:"#fffbf3",borderRadius:10,padding:"10px 12px",borderLeft:"3px solid #F4A261"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#c97e1a",marginBottom:3}}>Ejemplo</div>
      <div style={{fontSize:12,color:"#666",lineHeight:1.55,fontStyle:"italic"}}>{example}</div>
    </div>}
  </div>
);

const Btn = ({children,onClick,disabled,outline}) => (
  <button onClick={onClick} disabled={disabled}
    style={{width:"100%",padding:14,borderRadius:14,
      border:outline?"1.5px solid #1a1a2e":"none",
      background:disabled?"#d0d0e0":outline?"#fff":"#1a1a2e",
      color:disabled?"#aaa":outline?"#1a1a2e":"#fff",
      fontWeight:800,fontSize:15,cursor:disabled?"not-allowed":"pointer",
      marginTop:8,fontFamily:"inherit"}}>
    {children}
  </button>
);

const Divider = ({label}) => (
  <div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0"}}>
    <div style={{flex:1,height:1,background:"#e8e8f0"}}/>
    <span style={{fontSize:12,color:"#aaa",fontWeight:600}}>{label}</span>
    <div style={{flex:1,height:1,background:"#e8e8f0"}}/>
  </div>
);

const GeoSel = ({pais,provincia,ciudad,onChange}) => {
  const provs = PROVINCIAS[pais] || PROVINCIAS.default;
  return (
    <div>
      <Sel label="País *" value={pais||""} onChange={v=>onChange({pais:v,provincia:"",ciudad:""})}
        options={[{v:"",l:"Seleccioná tu país..."},...PAISES]}/>
      {pais&&provs.length>0&&(
        <Sel label="Provincia / Estado *" value={provincia||""} onChange={v=>onChange({pais,provincia:v,ciudad:""})}
          options={[{v:"",l:"Seleccioná provincia..."},...provs.map(p=>({v:p,l:p}))]}/>
      )}
      {pais&&provs.length===0&&(
        <Inp label="Provincia / Estado" placeholder="Tu provincia o estado" value={provincia||""} onChange={v=>onChange({pais,provincia:v,ciudad})}/>
      )}
      {provincia&&(
        <Inp label="Ciudad / Localidad *" placeholder="Ej: Buenos Aires..." value={ciudad||""} onChange={v=>onChange({pais,provincia,ciudad:v})} hint="Tu base para filtrar oportunidades"/>
      )}
    </div>
  );
};

const FotoPicker = ({foto, onFoto, color, init, size=80}) => {
  const ref      = useRef(null);
  const [src,    setSrc]    = useState(null);
  const [crop,   setCrop]   = useState(false);
  const [zoom,   setZoom]   = useState(1);
  const [offX,   setOffX]   = useState(0);
  const [offY,   setOffY]   = useState(0);
  const [drag,   setDrag]   = useState(false);
  const [startP, setStartP] = useState({x:0,y:0});

  const handleFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSrc(ev.target.result);
      setCrop(true);
      setZoom(1); setOffX(0); setOffY(0);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onStart = (cx,cy) => { setDrag(true); setStartP({x:cx-offX, y:cy-offY}); };
  const onMove  = (cx,cy) => { if(!drag) return; setOffX(cx-startP.x); setOffY(cy-startP.y); };
  const onEnd   = ()      => setDrag(false);

  const confirmar = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(32,32,32,0,Math.PI*2);
      ctx.clip();
      const scale = Math.max(64/img.width, 64/img.height) * zoom;
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (64-w)/2 + offX*(64/240);
      const y = (64-h)/2 + offY*(64/240);
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      onFoto(canvas.toDataURL("image/jpeg", 0.6));
      setCrop(false); setSrc(null);
    };
    img.src = src;
  };

  if(crop && src) return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,0.96)",zIndex:4000,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:20,maxWidth:420,margin:"0 auto"}}>
      <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:4}}>Ajustá tu foto</div>
      <div style={{fontSize:13,color:"#aaa",marginBottom:16,textAlign:"center"}}>
        Arrastrá para reencuadrar · Zoom con el slider
      </div>
      {/* Vista previa circular */}
      <div style={{width:240,height:240,borderRadius:"50%",overflow:"hidden",
        border:"3px solid #F4A261",cursor:drag?"grabbing":"grab",
        position:"relative",marginBottom:20,flexShrink:0,background:"#333"}}
        onMouseDown={e=>{onStart(e.clientX,e.clientY);}}
        onMouseMove={e=>{onMove(e.clientX,e.clientY);}}
        onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={e=>{onStart(e.touches[0].clientX,e.touches[0].clientY);}}
        onTouchMove={e=>{onMove(e.touches[0].clientX,e.touches[0].clientY);}}
        onTouchEnd={onEnd}>
        <img src={src} alt="crop" draggable={false} style={{
          position:"absolute",maxWidth:"none",
          width:(240*zoom)+"px",height:"auto",
          left:"50%",top:"50%",
          transform:"translate(calc(-50% + "+offX+"px), calc(-50% + "+offY+"px))",
          userSelect:"none",WebkitUserSelect:"none",pointerEvents:"none"}}/>
      </div>
      {/* Zoom slider */}
      <div style={{width:"100%",maxWidth:240,marginBottom:24}}>
        <div style={{fontSize:12,color:"#aaa",marginBottom:6,textAlign:"center"}}>
          Zoom: {Math.round(zoom*100)}%
        </div>
        <input type="range" min={80} max={300} step={5} value={Math.round(zoom*100)}
          onChange={e=>setZoom(Number(e.target.value)/100)}
          style={{width:"100%",accentColor:"#F4A261"}}/>
      </div>
      <div style={{display:"flex",gap:12,width:"100%",maxWidth:280}}>
        <button onClick={()=>{setCrop(false);setSrc(null);}}
          style={{flex:1,padding:"12px 0",borderRadius:12,
            border:"1.5px solid rgba(255,255,255,0.2)",background:"transparent",
            color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
          Cancelar
        </button>
        <button onClick={confirmar}
          style={{flex:2,padding:"12px 0",borderRadius:12,border:"none",
            background:"#F4A261",color:"#1a1a2e",fontWeight:800,fontSize:14,
            cursor:"pointer",fontFamily:"inherit"}}>
          Usar esta foto
        </button>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:20}}>
      <div style={{position:"relative",marginBottom:12}}>
        <Av init={init} color={color||"#1a1a2e"} size={size} foto={foto}/>
      </div>
      <label style={{
        display:"inline-flex",alignItems:"center",gap:6,
        padding:"8px 20px",borderRadius:99,
        background:"#f0f0f8",border:"1.5px solid #e0e0ef",
        fontSize:13,fontWeight:600,color:"#1a1a2e",
        cursor:"pointer",userSelect:"none",
      }}>
        📷 {foto ? "Cambiar foto" : "Subir foto"}
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{display:"none"}}
        />
      </label>
    </div>
  );
};


const SkillSelector = ({selected,onChange,label}) => {
  const [otroVal,setOtroVal] = useState("");
  const [showOtro,setShowOtro] = useState(false);
  const toggle = s => onChange(selected.includes(s)?selected.filter(x=>x!==s):[...selected,s]);
  const addOtro = () => {
    const v=otroVal.trim();
    if(v&&!selected.includes(v)){onChange([...selected,v]);setOtroVal("");setShowOtro(false);}
  };
  const custom = selected.filter(s=>!SKILLS.includes(s));
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{label}</label>
        <span style={{fontSize:11,color:"#888"}}>{selected.length} sel.</span>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {SKILLS.map(s=><Chip key={s} selected={selected.includes(s)} onClick={()=>toggle(s)}>{s}</Chip>)}
        {custom.map(s=>(
          <Chip key={s} selected color="#7B2D8B">
            {s} <span onClick={e=>{e.stopPropagation();onChange(selected.filter(x=>x!==s))}} style={{marginLeft:4,cursor:"pointer"}}>x</span>
          </Chip>
        ))}
        <Chip onClick={()=>setShowOtro(true)} color="#7B2D8B">+ Otro</Chip>
      </div>
      {showOtro&&(
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <input value={otroVal} onChange={e=>setOtroVal(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addOtro()} autoFocus placeholder="Tu skill..."
            style={{flex:1,padding:"10px 13px",borderRadius:12,border:"1.5px solid #7B2D8B",fontSize:13,outline:"none"}}/>
          <button onClick={addOtro} style={{padding:"10px 16px",borderRadius:12,background:"#7B2D8B",color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+</button>
          <button onClick={()=>setShowOtro(false)} style={{padding:"10px",borderRadius:12,background:"#f0f0f8",border:"none",cursor:"pointer",fontFamily:"inherit"}}>x</button>
        </div>
      )}
    </div>
  );
};

const Honorarios = ({value,moneda,onValue,onMoneda}) => (
  <div style={{marginBottom:18}}>
    <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:6}}>
      Honorarios por hora
    </label>
    <div style={{display:"flex",gap:8,marginBottom:10}}>
      {["ARS","USD"].map(m=>(
        <button key={m} onClick={()=>onMoneda(m)}
          style={{flex:1,padding:"10px",borderRadius:12,fontWeight:700,fontSize:14,
            border:moneda===m?"2px solid #1a1a2e":"2px solid #e0e0ef",
            background:moneda===m?"#1a1a2e":"#fff",
            color:moneda===m?"#fff":"#555",cursor:"pointer",fontFamily:"inherit"}}>
          {m==="ARS"?"$ Pesos":"U$D Dólares"}
        </button>
      ))}
    </div>
    <div style={{position:"relative"}}>
      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",
        fontSize:20,fontWeight:800,color:"#aaa"}}>{moneda==="USD"?"U$D":"$"}</span>
      <input type="number" min={0} value={value||""} onChange={e=>onValue(e.target.value)}
        placeholder="0"
        style={{width:"100%",padding:"14px 14px 14px 52px",borderRadius:12,
          border:"1.5px solid #e0e0ef",fontSize:22,fontWeight:800,color:"#1a1a2e",
          outline:"none",background:"#fff",boxSizing:"border-box"}}/>
    </div>
    <div style={{fontSize:12,color:"#aaa",marginTop:6}}>Dejá en 0 si preferís no indicarlo</div>
  </div>
);

const ObrasInput = ({obras,onChange}) => {
  const [val,setVal] = useState("");
  const add = () => {if(val.trim()){onChange([...obras,val.trim()]);setVal("");}};
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>Obras / trabajos destacados</label>
        <span style={{fontSize:11,color:"#aaa"}}>Opcional</span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&add()}
          placeholder="Ej: Torre Catalinas Norte 2023"
          style={{flex:1,padding:"11px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",fontSize:13,outline:"none"}}/>
        <button onClick={add}
          style={{padding:"11px 18px",borderRadius:12,background:"#1a1a2e",color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontSize:18,fontFamily:"inherit"}}>
          +
        </button>
      </div>
      {obras.map((o,i)=>(
        <div key={i} style={{background:"#f8f8fc",borderRadius:10,padding:"9px 12px",
          display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"#444",marginBottom:6}}>
          {o}
          <span onClick={()=>onChange(obras.filter((_,j)=>j!==i))}
            style={{color:"#E63946",cursor:"pointer",fontWeight:700,fontSize:16,marginLeft:8}}>x</span>
        </div>
      ))}
    </div>
  );
};

// ─── GOOGLE ───────────────────────────────────────────────────────────────────

const GLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" style={{flexShrink:0}}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const G_ACCOUNTS = [
  {name:"Gustavo De Rose", email:"gustavo.derose@gmail.com", color:"#1a73e8", init:"GD",
   nombre:"Gustavo", apellido:"De Rose", pais:"US", provincia:"Florida", ciudad:"St. Petersburg"},
  {name:"Proyecto HS", email:"proyectohs.canal@gmail.com", color:"#e8710a", init:"PH",
   nombre:"Proyecto", apellido:"HS", pais:"AR", provincia:"Buenos Aires", ciudad:"Buenos Aires"},
  {name:"Usar otra cuenta", email:null, color:"#5f6368", init:"+"},
];

const GooglePopup = ({onSelect,onClose}) => {
  const [loading,setLoading] = useState(null);
  const pick = acc => {
    if(!acc.email) return;
    setLoading(acc.email);
    setTimeout(()=>onSelect(acc),1400);
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",
      justifyContent:"center",background:"rgba(0,0,0,0.45)",padding:20}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:360,
        boxShadow:"0 8px 40px rgba(0,0,0,0.28)",animation:"popIn .22s ease",overflow:"hidden"}}>
        <div style={{padding:"22px 24px 16px",borderBottom:"1px solid #f0f0f0"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <GLogo/>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:"#666",cursor:"pointer",fontFamily:"inherit"}}>x</button>
          </div>
          <div style={{fontWeight:700,fontSize:17,color:"#202124",marginTop:14,marginBottom:2}}>Acceder a Safy</div>
          <div style={{fontSize:13,color:"#5f6368"}}>Elegí una cuenta para continuar</div>
        </div>
        {G_ACCOUNTS.map(acc=>(
          <button key={acc.email||"otro"} onClick={()=>pick(acc)} disabled={loading!==null}
            style={{width:"100%",background:loading===acc.email?"#f8f8ff":"#fff",border:"none",
              padding:"12px 24px",cursor:loading?"default":"pointer",display:"flex",
              alignItems:"center",gap:16,textAlign:"left",borderBottom:"1px solid #f5f5f5",fontFamily:"inherit"}}
            onMouseEnter={e=>{if(!loading)e.currentTarget.style.background="#f8f9fa"}}
            onMouseLeave={e=>{if(!loading)e.currentTarget.style.background="#fff"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:acc.color,
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"#fff",fontWeight:700,fontSize:15,flexShrink:0}}>{acc.init}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,color:"#202124",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.name}</div>
              {acc.email&&<div style={{fontSize:12,color:"#5f6368",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{acc.email}</div>}
            </div>
            {loading===acc.email
              ?<div style={{width:18,height:18,borderRadius:"50%",border:"2px solid #e0e0e0",
                  borderTopColor:"#1a73e8",animation:"spin .7s linear infinite",flexShrink:0}}/>
              :<span style={{color:"#bbb",fontSize:18}}>›</span>}
          </button>
        ))}
        <div style={{padding:"12px 24px 16px",borderTop:"1px solid #f0f0f0",
          display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:"#5f6368"}}>Español (Argentina)</span>
        </div>
      </div>
    </div>
  );
};

// ─── LOGO SVG ─────────────────────────────────────────────────────────────────

const SafyLogo = ({size=72}) => null;


// ─── SPLASH ───────────────────────────────────────────────────────────────────

const SplashScreen = ({onDone}) => {
  const [anim,setAnim] = useState("s");
  useEffect(()=>{
    const t1=setTimeout(()=>setAnim("af"),600);
    const t2=setTimeout(()=>setAnim("y"),1100);
    const t3=setTimeout(()=>setAnim("tag"),1500);
    const t4=setTimeout(()=>setAnim("out"),2000);
    const t5=setTimeout(()=>onDone(),2600);
    return ()=>[t1,t2,t3,t4,t5].forEach(clearTimeout);
  },[]);
  const fading = anim==="out";
  return (
    <div style={{position:"fixed",inset:0,background:"#1a1a2e",display:"flex",
      flexDirection:"column",alignItems:"center",justifyContent:"center",
      maxWidth:420,margin:"0 auto",zIndex:9999,
      opacity:fading?0:1,transition:fading?"opacity 0.9s ease":"none",
      pointerEvents:fading?"none":"auto"}}>
      <style>{`
        @keyframes sZoom{0%{transform:scale(4.5);opacity:0}40%{opacity:1}100%{transform:scale(1);opacity:1}}
        @keyframes slideInLeft{from{transform:translateX(-18px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes yBounce{0%{transform:translateY(14px) scale(.7);opacity:0}60%{transform:translateY(-4px) scale(1.08);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes fadeInTag{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes dotPulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{display:"flex",alignItems:"center",fontFamily:"inherit",letterSpacing:-3}}>
        {/* S — entra con zoom grande como Netflix */}
        <span style={{
          fontSize:96, fontWeight:800, color:"#fff", lineHeight:1,
          display:"inline-block",
          animation:"sZoom 0.65s cubic-bezier(0.22,1,0.36,1) forwards",
        }}>S</span>

        {/* "afy" — se desliza desde la derecha */}
        {(anim==="af"||anim==="y"||anim==="tag"||anim==="out")&&(
          <span style={{
            fontSize:96, fontWeight:800, lineHeight:1, display:"inline-block",
            animation:"slideInLeft 0.35s cubic-bezier(0.22,1,0.36,1) forwards",
          }}>
            <span style={{color:"#fff"}}>af</span>
            <span style={{
              color: anim==="y"||anim==="tag"||anim==="out" ? "#F4A261" : "#fff",
              transition:"color 0.3s ease",
            }}>y</span>
          </span>
        )}
      </div>
      <div style={{position:"absolute",bottom:52,display:"flex",gap:8,
        opacity:(anim==="af"||anim==="y"||anim==="tag"||anim==="out")?1:0,transition:"opacity 0.5s ease"}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:i===1?8:5,height:i===1?8:5,borderRadius:"50%",
            background:i===1?"#F4A261":"rgba(255,255,255,0.3)",
            animation:(anim==="af"||anim==="y"||anim==="tag"||anim==="out")?"dotPulse 1.4s ease "+(i*0.22)+"s infinite":"none"}}/>
        ))}
      </div>
    </div>
  );
};

// ─── WELCOME ──────────────────────────────────────────────────────────────────

const WelcomeScreen = ({onEntrar,onRegistrarse,visible=true}) => (
  <div style={{flex:1,display:"flex",flexDirection:"column",background:"#1a1a2e",minHeight:"100vh"}}>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",padding:"40px 32px"}}>
      {/* Wordmark solo, sin isotipo */}
      <div style={{
        fontWeight:800, fontSize:80, letterSpacing:-4, lineHeight:1, marginBottom:16,
        opacity:visible?1:0,
        transform:visible?"translateY(0)":"translateY(20px)",
        transition:"opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
      }}>
        <span style={{color:"#fff"}}>Saf</span><span style={{color:"#F4A261"}}>y</span>
      </div>
      <div style={{fontSize:13,color:"#7788aa",textAlign:"center",lineHeight:1.65,maxWidth:270,
        opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(12px)",
        transition:"opacity 0.7s ease 0.25s, transform 0.7s ease 0.25s"}}>
        El match inteligente para profesionales<br/>de Seguridad, Higiene y Medio Ambiente
      </div>
      <div style={{width:40,height:3,borderRadius:99,background:"#F4A261",margin:"24px 0 0",
        opacity:visible?1:0,transition:"opacity 0.6s ease 0.35s"}}/>
    </div>
    <div style={{padding:"0 28px 52px",display:"flex",flexDirection:"column",gap:12,
      opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",
      transition:"opacity 0.7s ease 0.4s, transform 0.7s ease 0.4s"}}>
      <button onClick={onEntrar}
        style={{width:"100%",padding:"16px",borderRadius:16,border:"2px solid rgba(255,255,255,0.2)",
          background:"transparent",color:"#fff",fontWeight:800,fontSize:17,cursor:"pointer",fontFamily:"inherit"}}>
        Ingresar
      </button>
      <button onClick={onRegistrarse}
        style={{width:"100%",padding:"16px",borderRadius:16,border:"none",background:"#F4A261",
          color:"#1a1a2e",fontWeight:800,fontSize:17,cursor:"pointer",fontFamily:"inherit",
          boxShadow:"0 4px 20px rgba(244,162,97,0.4)"}}>
        Crear cuenta
      </button>
      <div style={{textAlign:"center",fontSize:12,color:"rgba(85,102,119,0.8)",marginTop:4}}>
        Al registrarte aceptás los{" "}
        <span style={{color:"#F4A261",fontWeight:600}}>Términos</span>
        {" "}y la{" "}
        <span style={{color:"#F4A261",fontWeight:600}}>Política de privacidad</span>
      </div>
    </div>
  </div>
);


// ─── TOUR DE BIENVENIDA ───────────────────────────────────────────────────────

// ─── TOUR CONTEXTUAL ─────────────────────────────────────────────────────────

const TOUR_PRO = [
  {
    tab: "swipe",
    titulo: "Contactate con otros profesionales",
    desc: "Deslizá las tarjetas hacia la derecha si te interesa conectar con ese profesional. Si la otra persona también te elige, ¡es un match! Izquierda para pasar.",
    icono: "🔍",
  },
  {
    tab: "feed",
    titulo: "Oportunidades laborales",
    desc: "Acá aparecen todas las búsquedas activas de empresas. Al postularte, la empresa evaluará tu perfil. Si les interesás, te contactarán directamente.",
    icono: "🏗️",
  },
  {
    tab: "matches",
    titulo: "Tus conexiones con profesionales",
    desc: "Cuando vos y otro profesional se eligen mutuamente, aparece acá con su contacto directo. Sin intermediarios.",
    icono: "🤝",
  },
  {
    tab: "perfil",
    titulo: "Tu perfil público",
    desc: "Las empresas ven esto antes de hacer match. Completá tu foto, descripción y skills para destacarte entre los demás profesionales.",
    icono: "👤",
  },
];

const TOUR_EMP = [
  {
    tab: "mis_busquedas",
    titulo: "Publicá búsquedas",
    desc: "Tocá el botón \"+\" para publicar tu primera búsqueda. Los profesionales la verán y podrán postularse. Vos decidís a quién contactar.",
    icono: "📋",
  },
  {
    tab: "swipe",
    titulo: "Descubrí profesionales",
    desc: "Explorá perfiles de profesionales SyH/MA disponibles cerca tuyo. Deslizá a la derecha para mostrar interés. Si el profesional también te elige, ¡es un match!",
    icono: "🔍",
  },
  {
    tab: "matches",
    titulo: "Tus conexiones con profesionales",
    desc: "Cuando vos y un profesional se eligen mutuamente, aparece acá con su contacto directo — email y teléfono — para coordinar sin intermediarios.",
    icono: "🤝",
  },
  {
    tab: "perfil",
    titulo: "Perfil de tu empresa",
    desc: "Los profesionales ven el perfil de tu empresa antes de hacer match. Completá los datos para generar confianza y atraer los mejores candidatos.",
    icono: "🏢",
  },
];

const TourContextual = ({rol, tabActual, setTab, onFin}) => {
  const [paso, setPaso] = useState(0);
  const pasos = rol === "empresa" ? TOUR_EMP : TOUR_PRO;
  const p = pasos[paso];
  const esUltimo = paso === pasos.length - 1;

  // Navegar al tab del paso actual
  useEffect(()=>{
    if(p && p.tab) setTab(p.tab);
  },[paso]);

  const siguiente = () => {
    if(esUltimo) { onFin(); }
    else { setPaso(s=>s+1); }
  };

  return (
    <>
      {/* Overlay semitransparente suave — no bloquea todo */}
      <div style={{
        position:"fixed",inset:0,background:"rgba(26,26,46,0.55)",
        zIndex:500,pointerEvents:"none",
        maxWidth:420,margin:"0 auto",
      }}/>

      {/* Tooltip flotante abajo */}
      <div style={{
        position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",
        width:"calc(100% - 32px)",maxWidth:388,
        background:"#fff",borderRadius:20,
        boxShadow:"0 8px 40px rgba(26,26,46,0.25)",
        zIndex:600,padding:"20px 20px 16px",
        animation:"fadeUp 0.3s ease",
      }}>
        {/* Header del tooltip */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:36,height:36,borderRadius:12,
              background:"#1a1a2e",display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:18,flexShrink:0,
            }}>{p.icono}</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:2}}>
                Paso {paso+1} de {pasos.length}
              </div>
              <div style={{fontWeight:800,fontSize:15,color:"#1a1a2e",lineHeight:1.2}}>
                {p.titulo}
              </div>
            </div>
          </div>
          {/* X para saltar */}
          <button onClick={onFin} style={{
            background:"none",border:"none",color:"#ccc",fontSize:18,
            cursor:"pointer",padding:"0 0 4px 8px",lineHeight:1,fontFamily:"inherit",
            flexShrink:0,
          }}>×</button>
        </div>

        {/* Descripción */}
        <p style={{
          fontSize:13,color:"#555",lineHeight:1.6,
          margin:"0 0 16px",
        }}>{p.desc}</p>

        {/* Barra de progreso */}
        <div style={{display:"flex",gap:4,marginBottom:14}}>
          {pasos.map((_,i)=>(
            <div key={i} style={{
              flex:1,height:3,borderRadius:99,
              background:i<=paso?"#F4A261":"#e0e0ef",
              transition:"background 0.3s",
            }}/>
          ))}
        </div>

        {/* Botones */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onFin} style={{
            padding:"10px 16px",borderRadius:12,
            border:"1.5px solid #e0e0ef",background:"#fff",
            color:"#aaa",fontSize:12,fontWeight:600,cursor:"pointer",
            fontFamily:"inherit",
          }}>
            Saltar tour
          </button>
          <button onClick={siguiente} style={{
            flex:1,padding:"10px",borderRadius:12,
            border:"none",background:"#1a1a2e",
            color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",
            fontFamily:"inherit",
          }}>
            {esUltimo?"¡Listo! →":"Siguiente →"}
          </button>
        </div>
      </div>
    </>
  );
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────

const LoginScreen = ({onLogin,isRegistro}) => {
  const [mode,setMode] = useState("main");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [magicSent,setMagicSent] = useState(false);

  const handleEmail = async () => {
    if(!email.includes("@")) return;
    setLoading(true); setError("");
    try {
      if(isRegistro) {
        if(password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); setLoading(false); return; }
        const res = await supa.signUpEmail(email, password);
        if(res.error) { setError(res.error.message || "Error al registrarse"); setLoading(false); return; }
        const loginRes = await supa.signInEmail(email, password);
        if(loginRes.access_token) {
          supa.saveSession({ token: loginRes.access_token, user: loginRes.user, email });
          onLogin({ token: loginRes.access_token, user: loginRes.user, email });
        } else { setError("Cuenta creada. Verificá tu email para ingresar."); }
      } else {
        const res = await supa.signInEmail(email, password);
        if(res.access_token) {
          supa.saveSession({ token: res.access_token, user: res.user, email });
          onLogin({ token: res.access_token, user: res.user, email });
        } else { setError(res.error?.message || "Email o contraseña incorrectos"); }
      }
    } catch(e) { setError("Error de conexión"); }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    if(!email.includes("@")) return;
    setLoading(true); setError("");
    try {
      await supa.signInMagicLink(email);
      setMagicSent(true);
    } catch(e) { setError("Error al enviar el link"); }
    setLoading(false);
  };

  if(magicSent) return (
    <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"32px 24px",textAlign:"center"}}>
      <div style={{fontSize:56,marginBottom:16}}>📩</div>
      <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:8}}>Revisá tu email</div>
      <div style={{color:"#666",fontSize:14,lineHeight:1.6,marginBottom:24}}>
        Enviamos un link de acceso a<br/><strong style={{color:"#1a1a2e"}}>{email}</strong>
      </div>
      <div style={{background:"#f0fdf4",borderRadius:14,padding:"14px 16px",border:"1.5px solid #86efac",marginBottom:24}}>
        <div style={{fontSize:13,color:"#15803d",lineHeight:1.5}}>
          Tocá el botón del email para ingresar automáticamente. Sin contraseña.
        </div>
      </div>
      <button onClick={()=>setMagicSent(false)} style={{background:"none",border:"none",color:"#888",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
        Volver
      </button>
    </div>
  );

  if(mode==="email") return (
    <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"32px 24px"}}>
      <button onClick={()=>setMode("main")} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",textAlign:"left",marginBottom:24,padding:0,fontFamily:"inherit"}}>‹</button>
      <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:4}}>{isRegistro?"Crear cuenta":"Ingresar con email"}</div>
      <div style={{color:"#888",fontSize:13,marginBottom:24}}>{isRegistro?"Usá tu email para registrarte":"Ingresá tu email y contraseña"}</div>
      <Inp label="Email" type="email" placeholder="tucorreo@gmail.com" value={email} onChange={setEmail}/>
      <Inp label="Contraseña" type="password" placeholder={isRegistro?"Mínimo 6 caracteres":"Tu contraseña"} value={password} onChange={setPassword}/>
      {error&&<div style={{background:"#fdecea",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#E63946",fontWeight:600}}>{error}</div>}
      <Btn onClick={handleEmail} disabled={loading||!email.includes("@")||!password}>
        {loading?"Procesando...":(isRegistro?"Crear cuenta":"Ingresar")}
      </Btn>
      <Divider label="o sin contraseña"/>
      <button onClick={handleMagicLink} disabled={loading||!email.includes("@")}
        style={{width:"100%",padding:14,borderRadius:14,border:"1.5px solid #e0e0ef",background:"#fff",color:"#1a1a2e",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
        Enviarme un link mágico ✨
      </button>
    </div>
  );

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"32px 24px"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontWeight:800,fontSize:30,color:"#1a1a2e",letterSpacing:-1,marginBottom:4}}>S<span style={{color:"#F4A261"}}>afy</span></div>
        <div style={{fontWeight:700,fontSize:18,color:"#1a1a2e",marginBottom:4}}>{isRegistro?"Crear cuenta":"Ingresar"}</div>
        <div style={{fontSize:13,color:"#888"}}>{isRegistro?"Elegí cómo querés registrarte":"Bienvenido de vuelta"}</div>
      </div>
      <button onClick={()=>supa.signInGoogle()}
        style={{width:"100%",padding:"14px",borderRadius:14,border:"1.5px solid #dadce0",background:"#fff",fontWeight:600,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,color:"#3c4043",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",fontFamily:"inherit"}}>
        <GLogo/> Continuar con Google
      </button>
      <Divider label="o con email"/>
      <button onClick={()=>setMode("email")}
        style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"#1a1a2e",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"inherit",marginBottom:10}}>
        ✉️ Continuar con email
      </button>
      <button onClick={handleMagicLink}
        style={{width:"100%",padding:"14px",borderRadius:14,border:"1.5px solid #e0e0ef",background:"#fff",fontWeight:600,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"#1a1a2e",fontFamily:"inherit"}}>
        ✨ Link mágico (sin contraseña)
      </button>
      <div style={{marginTop:16,textAlign:"center",fontSize:12,color:"rgba(85,102,119,0.8)"}}>
        Al registrarte aceptás los <span style={{color:"#F4A261",fontWeight:600,cursor:"pointer"}}>Términos</span> y la <span style={{color:"#F4A261",fontWeight:600,cursor:"pointer"}}>Política de privacidad</span>
      </div>
    </div>
  );
};

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

const ProgBar = ({step,total}) => (
  <div style={{padding:"8px 20px 0",display:"flex",gap:4}}>
    {Array.from({length:total}).map((_,i)=>(
      <div key={i} style={{flex:1,height:4,borderRadius:99,
        background:i<step?"#F4A261":"rgba(255,255,255,0.3)",transition:"background .3s"}}/>
    ))}
  </div>
);

const OBHead = ({step,total,onBack}) => (
  <div style={{background:"#1a1a2e",padding:"14px 20px 0",flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
      <button onClick={onBack}
        style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,lineHeight:1,fontFamily:"inherit"}}>
        ‹
      </button>
      <span style={{flex:1,fontWeight:800,fontSize:18,color:"#fff",letterSpacing:-.5}}>
        S<span style={{color:"#F4A261"}}>afy</span>
      </span>
      <span style={{fontSize:12,color:"#aaa",fontWeight:600}}>{step} / {total}</span>
    </div>
    <ProgBar step={step} total={total}/>
  </div>
);

// Pasos profesional — estado LOCAL para evitar re-renders

// ─── TOGGLE SEGURO ────────────────────────────────────────────────────────────
const ToggleSeguro = ({pais, value, onChange, esOferta=false}) => {
  const nombreSeguro = getSeguro(pais||"AR");
  const opSi  = esOferta ? "Si, se ofrece cobertura" : "Si, tengo cobertura";
  const opNo  = esOferta ? "No se ofrece cobertura"  : "No tengo cobertura";
  return (
    <div style={{marginBottom:18}}>
      <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>
        {esOferta ? "Esta oferta incluye cobertura de seguro" : "Cobertura de seguro"}
      </label>
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>{nombreSeguro}</div>
      <div style={{display:"flex",gap:10}}>
        {[{v:true,l:opSi,ic:"OK"},{v:false,l:opNo,ic:"NO"}].map(function(item){
          var v=item.v; var l=item.l;
          return (
            <button key={String(v)} onClick={function(){onChange(v);}}
              style={{flex:1,padding:"11px 8px",borderRadius:12,cursor:"pointer",
                fontFamily:"inherit",fontSize:12,fontWeight:value===v?700:400,
                textAlign:"center",lineHeight:1.3,
                border:value===v?(v?"1.5px solid #2A9D8F":"1.5px solid #E63946"):"1.5px solid #e0e0ef",
                background:value===v?(v?"#e8f7f5":"#fdecea"):"#fff",
                color:value===v?(v?"#2A9D8F":"#E63946"):"#888"}}>
              <div style={{fontSize:18,marginBottom:4}}>{v?"✅":"❌"}</div>
              {l}
            </button>
          );
        })}
      </div>
      {value===false&&(
        <div style={{marginTop:8,fontSize:11,color:"#E63946",lineHeight:1.4}}>
          {esOferta
            ? "Muchos profesionales priorizan ofertas con cobertura."
            : "Muchas empresas exigen cobertura. Te recomendamos obtenerla."}
        </div>
      )}
      {value===true&&(
        <div style={{marginTop:8,fontSize:11,color:"#2A9D8F",lineHeight:1.4}}>
          {esOferta
            ? "Especificalo en el contrato con el profesional."
            : "Tene la poliza vigente y a disposicion del contratante."}
        </div>
      )}
    </div>
  );
};

// ─── BADGE ESTADO POSTULACIÓN ─────────────────────────────────────────────────
const ESTADOS_LIST = [
  {k:"pendiente",  label:"Pendiente",   color:"#6b7280", bg:"#f3f4f6", icon:"🔵"},
  {k:"visto",      label:"Visto",       color:"#1D9BF0", bg:"#e8f4ff", icon:"👁"},
  {k:"proceso",    label:"En proceso",  color:"#F4A261", bg:"#fff3e0", icon:"⚙️"},
  {k:"contratado", label:"Contratado",  color:"#2A9D8F", bg:"#e8f7f5", icon:"✅"},
  {k:"descartado", label:"Descartado",  color:"#E63946", bg:"#fdecea", icon:"❌"},
];
const getEstado = function(k){ return ESTADOS_LIST.find(function(e){return e.k===k;})||ESTADOS_LIST[0]; };

const BadgeEstado = ({estado}) => {
  var e = getEstado(estado||"pendiente");
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,
      background:e.bg,color:e.color,padding:"3px 10px",borderRadius:99,
      fontSize:11,fontWeight:700}}>
      {e.icon} {e.label}
    </span>
  );
};

const SelectorEstado = ({estado, onChange}) => {
  const [open, setOpen] = useState(false);
  var e = getEstado(estado||"pendiente");
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={function(){setOpen(function(o){return !o;});}}
        style={{display:"inline-flex",alignItems:"center",gap:5,
          background:e.bg,color:e.color,border:"1.5px solid rgba(0,0,0,0.1)",
          padding:"6px 10px",borderRadius:99,fontSize:11,fontWeight:700,
          cursor:"pointer",fontFamily:"inherit"}}>
        {e.icon} {e.label} ▾
      </button>
      {open&&(
        <div style={{position:"absolute",bottom:"110%",left:0,background:"#fff",
          borderRadius:12,padding:6,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",
          zIndex:200,minWidth:160,border:"1px solid #f0f0f0"}}>
          {ESTADOS_LIST.map(function(op){
            return (
              <button key={op.k}
                onClick={function(){onChange(op.k);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:8,width:"100%",
                  padding:"8px 10px",borderRadius:8,border:"none",
                  background:(estado||"pendiente")===op.k?op.bg:"transparent",
                  color:op.color,
                  fontWeight:(estado||"pendiente")===op.k?700:500,
                  fontSize:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {op.icon} {op.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── BADGE VERIFICADO ─────────────────────────────────────────────────────────
const BadgeVerificado = ({size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{flexShrink:0,verticalAlign:"middle",display:"inline-block"}}>
    <circle cx="12" cy="12" r="12" fill="#1D9BF0"/>
    <path d="M6.5 12.5L10 16L17.5 8.5" stroke="white" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── VERIFICADO ACTIVO ────────────────────────────────────────────────────────
const VerificadoActivo = ({onCancelar, esEmpresa=false}) => {
  const [confirmando, setConfirmando] = useState(false);
  if(confirmando) return (
    <div style={{background:"#fdecea",borderRadius:14,padding:"14px 16px",marginBottom:10,
      border:"1.5px solid #E63946"}}>
      <div style={{fontWeight:700,fontSize:13,color:"#E63946",marginBottom:6}}>Cancelar suscripcion</div>
      <div style={{fontSize:12,color:"#666",lineHeight:1.5,marginBottom:12}}>
        Tu verificacion permanecera activa hasta el final del mes en curso.
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={function(){setConfirmando(false);}}
          style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #e0e0ef",
            background:"#fff",color:"#555",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Mantener
        </button>
        <button onClick={onCancelar}
          style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",
            background:"#E63946",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Confirmar cancelacion
        </button>
      </div>
    </div>
  );
  return (
    <div style={{background:"#e8f4ff",borderRadius:14,padding:"12px 16px",marginBottom:10,
      display:"flex",alignItems:"center",gap:8,border:"1px solid #bee3f8"}}>
      <BadgeVerificado size={16}/>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1D9BF0"}}>
          {esEmpresa?"Empresa Verificada":"Profesional Verificado"}
        </div>
        <div style={{fontSize:11,color:"#5b9bd5"}}>
          Suscripcion activa · {esEmpresa?"U$D 9.99":"U$D 2.99"}/mes
        </div>
      </div>
      <button onClick={function(){setConfirmando(true);}}
        style={{background:"none",border:"none",fontSize:11,color:"#aaa",
          cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",padding:0}}>
        Cancelar
      </button>
    </div>
  );
};

// ─── VERIFICACION SECTION ─────────────────────────────────────────────────────
const VerificacionSection = ({verificado, onVerificar, onCancelar, esEmpresa=false}) => (
  <div style={{marginBottom:16}}>
    <div style={{fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",
      letterSpacing:.5,marginBottom:10}}>
      Verificacion profesional
    </div>
    {verificado?(
      <VerificadoActivo onCancelar={onCancelar} esEmpresa={esEmpresa}/>
    ):(
      <button onClick={onVerificar}
        style={{width:"100%",padding:13,borderRadius:14,border:"1.5px solid #1D9BF0",
          background:"#fff",color:"#1D9BF0",fontWeight:700,fontSize:13,
          cursor:"pointer",fontFamily:"inherit",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <BadgeVerificado size={15}/>
        {esEmpresa?"Verificá tu empresa · U$D 9.99/mes":"Verificá tu cuenta · U$D 2.99/mes"}
      </button>
    )}
  </div>
);

// ─── MODAL SUSCRIPCION ────────────────────────────────────────────────────────
const ModalSuscripcion = ({onClose, onSuscribir, esEmpresa=false}) => {
  const [procesando, setProcesando] = useState(false);
  const [exito, setExito] = useState(false);
  const handlePago = function(){
    setProcesando(true);
    setTimeout(function(){setProcesando(false);setExito(true);}, 2000);
    setTimeout(function(){onSuscribir();onClose();}, 3200);
  };
  var beneficiosPro = [
    "Badge azul verificado junto a tu nombre en toda la app",
    "Prioridad en los resultados — apareces primero",
    "Mayor credibilidad frente a empresas y profesionales",
    "Sello de autenticidad que valida tu perfil e identidad",
    "Estadisticas de visitas y postulaciones a tu perfil",
    "Acceso anticipado a nuevas oportunidades y funciones",
  ];
  var beneficiosEmp = [
    "Badge azul en tu perfil — demuestra que tu empresa es real y confiable",
    "Busquedas ilimitadas — publica sin restricciones ni topes mensuales",
    "Tus avisos aparecen primero y atraen mas postulantes calificados",
    "Acceso a estadisticas de postulantes, visitas y rendimiento de avisos",
    "Mayor tasa de respuesta — los profesionales priorizan empresas verificadas",
    "Sello oficial de Safy que valida la identidad y seriedad de tu organizacion",
  ];
  var beneficios = esEmpresa ? beneficiosEmp : beneficiosPro;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,.92)",zIndex:3000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:24,padding:28,maxWidth:340,width:"100%",
        animation:"popIn .3s ease",textAlign:"center",maxHeight:"90vh",overflowY:"auto"}}>
        {exito?(
          <>
            <div style={{fontSize:56,marginBottom:12}}>🎉</div>
            <div style={{fontWeight:800,fontSize:20,color:"#1a1a2e",marginBottom:6}}>
              {esEmpresa?"Tu empresa esta verificada":"Sos Profesional Verificado"}
            </div>
            <div style={{fontSize:13,color:"#888",lineHeight:1.5}}>
              {esEmpresa
                ? "Tu badge azul ya aparece. Ahora podes publicar busquedas ilimitadas."
                : "Tu badge azul ya aparece en tu perfil."}
            </div>
          </>
        ):(
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
              <div style={{fontWeight:800,fontSize:20,color:"#1a1a2e"}}>
                {esEmpresa?"Empresa Verificada":"Profesional Verificado"}
              </div>
              <BadgeVerificado size={20}/>
            </div>
            <div style={{fontSize:13,color:"#888",marginBottom:14}}>
              {esEmpresa?"Publica busquedas ilimitadas y genera mas confianza":"Destacate del resto y genera mas confianza"}
            </div>
            <div style={{background:"#e8f4ff",borderRadius:14,padding:"12px 14px",marginBottom:14,
              border:"1.5px solid #1D9BF0",textAlign:"left"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#1D9BF0",marginBottom:6}}>
                Por que verificarte?
              </div>
              <div style={{fontSize:12,color:"#1a4a6e",lineHeight:1.6}}>
                {esEmpresa
                  ? "El badge azul transmite la legitimidad y seriedad de tu empresa frente a los profesionales del sector. Las empresas verificadas generan mas postulaciones e inspiran confianza."
                  : "El badge azul es una señal inmediata de confianza para empresas y profesionales. Los perfiles verificados aparecen primero en las busquedas y generan mas conexiones."}
              </div>
            </div>
            <div style={{background:"#f8f8fc",borderRadius:16,padding:"14px 16px",marginBottom:18,textAlign:"left"}}>
              {beneficios.map(function(b,i){
                return (
                  <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                    <span style={{color:"#1D9BF0",fontWeight:700,flexShrink:0}}>✓</span>
                    <span style={{fontSize:13,color:"#444",lineHeight:1.4}}>{b}</span>
                  </div>
                );
              })}
            </div>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:22,fontWeight:400,color:"#555",lineHeight:1}}>
                U$D {esEmpresa?"9.99":"2.99"}<span style={{fontSize:14,color:"#bbb"}}> /mes</span>
              </div>
              <div style={{fontSize:12,color:"#aaa",marginTop:6}}>
                {esEmpresa?"busquedas ilimitadas · cancela cuando quieras":"cancela cuando quieras · menos de un cafe al mes"}
              </div>
            </div>
            <button onClick={handlePago} disabled={procesando}
              style={{width:"100%",padding:"14px 0",borderRadius:14,border:"none",
                background:procesando?"#ccc":"#1D9BF0",color:"#fff",fontWeight:800,
                fontSize:15,cursor:procesando?"not-allowed":"pointer",
                fontFamily:"inherit",marginBottom:10,display:"flex",
                alignItems:"center",justifyContent:"center",gap:8}}>
              {procesando
                ?<><div style={{width:18,height:18,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite"}}/> Procesando...</>
                :"Suscribirme ahora"}
            </button>
            <button onClick={onClose}
              style={{background:"none",border:"none",color:"#aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── MODAL LEGAL ──────────────────────────────────────────────────────────────
const ModalLegal = ({tipo, onClose}) => {
  var esTyC = tipo==="terminos";
  var titulo = esTyC?"Terminos y Condiciones":"Politica de Privacidad";
  var items = esTyC ? [
    {t:"1. Descripcion del servicio", c:"Safy es una plataforma de conexion profesional en SyH/MA. Actua como intermediario tecnologico y NO es una agencia de empleo ni garantiza contratos."},
    {t:"2. Responsabilidad del usuario", c:"El usuario declara que su perfil es veraz. Safy no verifica titulos ni matriculas."},
    {t:"3. Limitacion de responsabilidad", c:"Safy NO se responsabiliza por falta de pago, incumplimientos contractuales, accidentes laborales, conductas antieticas ni danos entre usuarios."},
    {t:"4. Contrataciones", c:"Los acuerdos son responsabilidad de las partes. Las empresas deben validar credenciales antes de contratar."},
    {t:"5. Ley aplicable", c:"Rige la ley argentina. Jurisdiccion: tribunales de CABA. Contacto: legal@safy.app"},
  ] : [
    {t:"1. Datos que recopilamos", c:"Nombre, email, telefono, foto, ubicacion, titulo, experiencia, skills y descripcion. Tambien datos de uso y geolocalizacion."},
    {t:"2. Para que usamos tus datos", c:"Crear tu perfil, conectarte segun ubicacion, enviarte notificaciones y mejorar la Plataforma."},
    {t:"3. Que ven otros usuarios", c:"Nombre, foto, titulo, ciudad y skills. Tu email y telefono solo se comparten al hacer match."},
    {t:"4. No vendemos tus datos", c:"Safy no vende datos a terceros. Solo con proveedores bajo acuerdos de confidencialidad."},
    {t:"5. Tus derechos", c:"Podes acceder, rectificar y eliminar tus datos. Al eliminar tu cuenta, los datos se borran en 30 dias habiles."},
    {t:"6. Ley aplicable", c:"Ley 25.326 (Argentina), RGPD (Espana). Contacto: privacidad@safy.app"},
  ];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,0.92)",zIndex:3000,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:420,
        maxHeight:"85vh",display:"flex",flexDirection:"column",animation:"slideUp .25s ease"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid #f0f0f0",
          display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e"}}>{titulo}</div>
          <button onClick={onClose}
            style={{background:"none",border:"none",fontSize:22,color:"#aaa",cursor:"pointer",fontFamily:"inherit"}}>x</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px 32px"}}>
          {items.map(function(item,i){
            return (
              <div key={i} style={{marginBottom:20}}>
                <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e",marginBottom:6}}>{item.t}</div>
                <div style={{fontSize:13,color:"#555",lineHeight:1.65}}>{item.c}</div>
              </div>
            );
          })}
        </div>
        <div style={{padding:"16px 20px",borderTop:"1px solid #f0f0f0",flexShrink:0}}>
          <button onClick={onClose}
            style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"#1a1a2e",
              color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TERMS BAR ────────────────────────────────────────────────────────────────
const TermsBar = () => {
  const [modalTipo, setModalTipo] = useState(null);
  return (
    <div style={{textAlign:"center",fontSize:12,color:"rgba(85,102,119,0.8)",marginTop:4}}>
      {modalTipo&&<ModalLegal tipo={modalTipo} onClose={function(){setModalTipo(null);}}/>}
      Al registrarte aceptas los{" "}
      <button onClick={function(){setModalTipo("terminos");}}
        style={{background:"none",border:"none",color:"#F4A261",fontWeight:600,
          fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:0,textDecoration:"underline"}}>
        Terminos
      </button>
      {" "}y la{" "}
      <button onClick={function(){setModalTipo("privacidad");}}
        style={{background:"none",border:"none",color:"#F4A261",fontWeight:600,
          fontSize:12,cursor:"pointer",fontFamily:"inherit",padding:0,textDecoration:"underline"}}>
        Politica de privacidad
      </button>
    </div>
  );
};

// ─── ACEPTACION LEGAL ─────────────────────────────────────────────────────────
const AceptacionLegal = ({onConfirm}) => {
  const [acepta, setAcepta] = useState(false);
  const [modalTipo, setModalTipo] = useState(null);
  const [intento, setIntento] = useState(false);
  return (
    <div>
      {modalTipo&&<ModalLegal tipo={modalTipo} onClose={function(){setModalTipo(null);}}/>}
      <div style={{background:intento&&!acepta?"#fdecea":"#f8f8fc",borderRadius:14,
        padding:"14px 16px",marginBottom:16,
        border:intento&&!acepta?"1.5px solid #E63946":"1.5px solid #e0e0ef"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <button onClick={function(){setAcepta(function(a){return !a;});setIntento(false);}}
            style={{width:24,height:24,borderRadius:6,flexShrink:0,marginTop:1,
              border:acepta?"none":"2px solid #ccc",background:acepta?"#1a1a2e":"#fff",
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              color:"#fff",fontFamily:"inherit",fontSize:14,padding:0}}>
            {acepta?"✓":""}
          </button>
          <div style={{fontSize:13,color:"#444",lineHeight:1.6}}>
            He leido y acepto los{" "}
            <button onClick={function(){setModalTipo("terminos");}}
              style={{background:"none",border:"none",color:"#1a1a2e",fontWeight:700,
                fontSize:13,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit",padding:0}}>
              Terminos y Condiciones
            </button>
            {" "}y la{" "}
            <button onClick={function(){setModalTipo("privacidad");}}
              style={{background:"none",border:"none",color:"#1a1a2e",fontWeight:700,
                fontSize:13,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit",padding:0}}>
              Politica de Privacidad
            </button>
          </div>
        </div>
        {intento&&!acepta&&(
          <div style={{fontSize:12,color:"#E63946",marginTop:8,marginLeft:36,fontWeight:600}}>
            Debes aceptar los terminos para continuar.
          </div>
        )}
      </div>
      <div style={{fontSize:11,color:"#aaa",marginBottom:16,lineHeight:1.5}}>
        Tu aceptacion digital tiene validez legal (Ley 25.506).
      </div>
      <Btn onClick={function(){if(!acepta){setIntento(true);return;}onConfirm();}}>Entrar a Safy!</Btn>
    </div>
  );
};

const StepPro1 = ({data,set,onNext}) => {
  const [foto,setFoto] = useState(data.foto||"");
  const [n,setN] = useState(data.nombre||"");
  const [ap,setAp] = useState(data.apellido||"");
  const [em,setEm] = useState(data.email||"");
  const [tel,setTel] = useState(data.tel||"");
  const [geo,setGeo] = useState({pais:data.pais||"",provincia:data.provincia||"",ciudad:data.ciudad||""});
  const [ra,setRa] = useState(data.radio||30);
  const [geoLoading,setGeoLoading] = useState(false);
  const [geoError,setGeoError] = useState("");
  const [coords,setCoords] = useState({lat:data.lat||null,lng:data.lng||null});
  const emailOk = em.includes("@") && em.includes(".");
  const ok = n && ap && emailOk && geo.ciudad;
  const init = n&&ap ? (n[0]+ap[0]).toUpperCase() : "?";

  // Auto-detectar ubicación al montar el componente
  useEffect(()=>{
    if(geo.ciudad) return; // Ya tiene ubicación, no forzar
    if(!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const {latitude,longitude} = pos.coords;
          setCoords({lat:latitude,lng:longitude});
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=es`);
          const d = await r.json();
          const addr = d.address || {};
          // Mapear país
          const countryCode = (addr.country_code||"").toUpperCase();
          const paisMap = {AR:"AR",MX:"MX",CO:"CO",CL:"CL",PE:"PE",UY:"UY",PY:"PY",BO:"BO",EC:"EC",VE:"VE",BR:"BR",ES:"ES",US:"US"};
          const pais = paisMap[countryCode] || "otro";
          const provincia = addr.state || addr.region || "";
          const ciudad = addr.city || addr.town || addr.village || addr.municipality || "";
          if(ciudad) setGeo({pais, provincia, ciudad});
        } catch(e) {}
        setGeoLoading(false);
      },
      () => { setGeoLoading(false); },
      {timeout:8000, maximumAge:60000}
    );
  },[]);

  const detectarManual = () => {
    if(!navigator.geolocation) { setGeoError("Tu navegador no soporta geolocalización"); return; }
    setGeoLoading(true); setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const {latitude,longitude} = pos.coords;
          setCoords({lat:latitude,lng:longitude});
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=es`);
          const d = await r.json();
          const addr = d.address || {};
          const countryCode = (addr.country_code||"").toUpperCase();
          const paisMap = {AR:"AR",MX:"MX",CO:"CO",CL:"CL",PE:"PE",UY:"UY",PY:"PY",BO:"BO",EC:"EC",VE:"VE",BR:"BR",ES:"ES",US:"US"};
          const pais = paisMap[countryCode] || "otro";
          const provincia = addr.state || addr.region || "";
          const ciudad = addr.city || addr.town || addr.village || addr.municipality || "";
          if(ciudad) { setGeo({pais, provincia, ciudad}); }
          else { setGeoError("No pudimos detectar tu ciudad. Completá manualmente."); }
        } catch(e) { setGeoError("Error al obtener ubicación. Completá manualmente."); }
        setGeoLoading(false);
      },
      () => { setGeoError("Permiso denegado. Completá tu ubicación manualmente."); setGeoLoading(false); },
      {timeout:8000}
    );
  };

  const next = () => { set({...data,foto,nombre:n,apellido:ap,email:em,tel,...geo,radio:ra,lat:coords.lat,lng:coords.lng}); onNext(); };

  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Tus datos personales</div>
      <div style={{color:"#888",fontSize:13,marginBottom:12}}>Aparecerán en tu perfil público</div>
      {(data.nombre||data.email)&&(
        <div style={{background:"#f0fdf4",borderRadius:12,padding:"10px 14px",marginBottom:16,
          border:"1.5px solid #86efac",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🔗</span>
          <div style={{fontSize:12,color:"#15803d",fontWeight:600,lineHeight:1.4}}>
            Datos pre-completados desde tu cuenta Google.<br/>
            <span style={{fontWeight:400,color:"#166534"}}>Revisá y editá lo que necesites.</span>
          </div>
        </div>
      )}
      <FotoPicker foto={foto} onFoto={setFoto} color="#1a1a2e" init={init} size={80}/>
      <Inp label="Nombre *" placeholder="Ej: Gustavo" value={n} onChange={setN}/>
      <Inp label="Apellido *" placeholder="Ej: De Rose" value={ap} onChange={setAp}/>
      <Inp label="Email" optional type="email" placeholder="tucorreo@gmail.com" value={em} onChange={setEm}/>
      <Inp label="Teléfono" optional type="tel" placeholder="+54 9 11..." value={tel} onChange={setTel}/>

      {/* Geolocalización */}
      {geoLoading ? (
        <div style={{background:"#f0fdf4",borderRadius:12,padding:"12px 14px",marginBottom:16,
          display:"flex",alignItems:"center",gap:10,border:"1.5px solid #86efac"}}>
          <div style={{width:16,height:16,borderRadius:"50%",border:"2px solid #86efac",
            borderTopColor:"#2A9D8F",animation:"spin .7s linear infinite",flexShrink:0}}/>
          <span style={{fontSize:13,color:"#15803d",fontWeight:600}}>Detectando tu ubicación...</span>
        </div>
      ) : geo.ciudad ? (
        <div style={{background:"#f0fdf4",borderRadius:12,padding:"10px 14px",marginBottom:8,
          border:"1.5px solid #86efac",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:16}}>📍</span>
            <div>
              <div style={{fontSize:12,color:"#15803d",fontWeight:700}}>Ubicación detectada</div>
              <div style={{fontSize:12,color:"#166534"}}>{[geo.ciudad,geo.provincia,PAISES.find(p=>p.v===geo.pais)?.l].filter(Boolean).join(", ")}</div>
            </div>
          </div>
          <button onClick={()=>setGeo({pais:"",provincia:"",ciudad:""})}
            style={{background:"none",border:"none",color:"#aaa",fontSize:18,cursor:"pointer",fontFamily:"inherit"}}>×</button>
        </div>
      ) : (
        <button onClick={detectarManual}
          style={{width:"100%",padding:"11px",borderRadius:12,border:"1.5px dashed #2A9D8F",
            background:"transparent",color:"#2A9D8F",fontWeight:600,fontSize:13,
            cursor:"pointer",marginBottom:8,fontFamily:"inherit",display:"flex",
            alignItems:"center",justifyContent:"center",gap:8}}>
          📍 Detectar mi ubicación automáticamente
        </button>
      )}
      {geoError&&<div style={{fontSize:12,color:"#E63946",marginBottom:8}}>{geoError}</div>}
      <GeoSel pais={geo.pais} provincia={geo.provincia} ciudad={geo.ciudad} onChange={setGeo}/>

      {/* Slider de radio */}
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>Radio de trabajo</label>
          <span style={{fontSize:14,fontWeight:800,color:"#1a1a2e",background:"#f0f0f8",
            padding:"3px 10px",borderRadius:99}}>{ra} km</span>
        </div>
        <input type="range" min={5} max={200} step={5} value={ra}
          onChange={e=>setRa(Number(e.target.value))}
          style={{width:"100%",accentColor:"#1a1a2e",height:4}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#aaa",marginTop:4}}>
          <span>5 km</span>
          <span>100 km</span>
          <span>200 km</span>
        </div>
      </div>

      <Btn onClick={next} disabled={!ok}>Continuar</Btn>
    </div>
  );
};

const StepPro2 = ({data,set,onNext}) => {
  const [tit,setTit] = useState(data.titulo||"");
  const [titMA,setTitMA] = useState(data.tituloMA||"");
  const [exp,setExp] = useState(data.experiencia||"");
  const [desc,setDesc] = useState(data.descripcion||"");
  const pais = data.pais||"AR";
  const t = getT(pais);
  const opsSyH = [
    {v:"",          l:"Seleccioná tu título..."},
    {v:"no_aplica", l:"No aplica"},
    {v:"est_syh",   l:"Estudiante en "+t.disciplina},
    {v:"tec_syh",   l:"Técnico en "+t.disciplina},
    {v:"aud_syh",   l:"Auditor en "+t.disciplina},
    {v:"lic_syh",   l:"Licenciado en "+t.disciplina},
    {v:"ing_syh",   l:"Ingeniero en "+t.disciplina},
    ...(pais==="US" ? [
      {v:"osha30_con", l:"OSHA 30 — Construcción"},
      {v:"osha30_ind", l:"OSHA 30 — Industria General"},
      {v:"iso45001",   l:"Especialista ISO 45001"},
    ] : []),
  ];
  const opsMA = [
    {v:"",          l:"Sin título en Medio Ambiente (opcional)"},
    {v:"no_aplica", l:"No aplica"},
    {v:"est_ma",    l:"Estudiante en Ciencias Ambientales"},
    {v:"tec_ma",    l:"Técnico en Medio Ambiente"},
    {v:"aud_ma",    l:"Auditor Ambiental"},
    {v:"gest_ma",   l:"Gestor Ambiental"},
    {v:"lic_ma",    l:"Licenciado en Ciencias Ambientales"},
    {v:"ing_ma",    l:"Ingeniero Ambiental"},
  ];
  const next = () => { set({...data,titulo:tit,tituloMA:titMA,experiencia:exp,descripcion:desc}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Tu perfil profesional</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Lo primero que ven las empresas</div>

      <Sel
        label={"Título en " + t.disciplina + " *"}
        hint={"Seleccioná tu habilitación en " + t.abrev}
        value={tit}
        onChange={setTit}
        options={opsSyH}/>

      <Sel
        label="Título en Medio Ambiente"
        hint="Si también tenés formación ambiental"
        optional
        value={titMA}
        onChange={setTitMA}
        options={opsMA}/>

      <Sel label="Años de experiencia" optional value={exp} onChange={setExp}
        options={[{v:"",l:"Seleccioná..."},{v:"<1",l:"Menos de 1 año"},{v:"1-3",l:"1 a 3 años"},
          {v:"3-5",l:"3 a 5 años"},{v:"5-10",l:"5 a 10 años"},{v:">10",l:"Más de 10 años"}]}/>

      <Txt label="Descripción breve" optional value={desc} onChange={setDesc}
        hint="Máximo 3 oraciones."
        example="Licenciado en SyH con 5 años en obras de construcción en CABA. Especializado en trabajos en altura y APT."/>

      <Btn onClick={next} disabled={!tit&&!titMA}>Continuar</Btn>
    </div>
  );
};

const StepPro3 = ({data,set,onNext}) => {
  const [skills,setSkills] = useState(data.skills||[]);
  const [sectores,setSectores] = useState(data.sectores||[]);
  const [obras,setObras] = useState(data.obras||[]);
  const next = () => { set({...data,skills,sectores,obras}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Habilidades y experiencia</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Elegí al menos 2 skills</div>
      <SkillSelector label="Skills principales" selected={skills} onChange={setSkills}/>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:8}}>
          Sectores <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>Opcional</span>
        </label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {SECTORES.map(s=>(
            <Chip key={s} selected={sectores.includes(s)}
              onClick={()=>setSectores(c=>c.includes(s)?c.filter(x=>x!==s):[...c,s])}>
              {s}
            </Chip>
          ))}
        </div>
      </div>
      <ObrasInput obras={obras} onChange={setObras}/>
      <Btn onClick={next} disabled={skills.length<2}>Continuar</Btn>
    </div>
  );
};

const StepPro4 = ({data,set,onNext}) => {
  const [disp,setDisp] = useState(data.disponibilidad||"");
  const [dias,setDias] = useState(data.dias||[]);
  const [modal,setModal] = useState(data.modalidad||"");
  const [tarifa,setTarifa] = useState(data.tarifa||"");
  const [moneda,setMoneda] = useState(data.moneda||"ARS");
  const [hor,setHor] = useState(data.horario||"");
  const [seguro,setSeguro] = useState(data.seguro!==undefined?data.seguro:null);
  const next = () => { set({...data,disponibilidad:disp,dias,modalidad:modal,tarifa,moneda,horario:hor,seguro}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Disponibilidad y honorarios</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Las empresas verán estos datos</div>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:10}}>Estado *</label>
        {[{v:"disponible",e:"Disponible ahora",d:"Aparecés primero en resultados"},
          {v:"parcial",e:"Disponibilidad parcial",d:"Acepto proyectos puntuales"},
          {v:"no",e:"No disponible",d:"Podés cambiarlo cuando quieras"}].map(({v,e,d})=>(
          <button key={v} onClick={()=>setDisp(v)}
            style={{display:"flex",width:"100%",marginBottom:8,
              background:disp===v?"#f8f8fc":"#fff",
              border:disp===v?"2px solid #1a1a2e":"2px solid #e0e0ef",
              borderRadius:12,padding:"12px 14px",textAlign:"left",cursor:"pointer",fontFamily:"inherit",gap:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#1a1a2e"}}>{e}</div>
              <div style={{fontSize:12,color:"#888"}}>{d}</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:8}}>
          Días disponibles <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>Opcional</span>
        </label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {DIAS.map(d=>(
            <Chip key={d} selected={dias.includes(d)}
              onClick={()=>setDias(c=>c.includes(d)?c.filter(x=>x!==d):[...c,d])}>
              {d}
            </Chip>
          ))}
        </div>
      </div>
      <Sel label="Modalidad" optional value={modal} onChange={setModal}
        options={[{v:"",l:"Seleccioná..."},{v:"puntual",l:"Obra / trabajo puntual"},
          {v:"part",l:"Part-time"},{v:"full",l:"Full-time / dependencia"},
          {v:"cualquiera",l:"Cualquier modalidad"}]}/>
      <Honorarios value={tarifa} moneda={moneda} onValue={setTarifa} onMoneda={setMoneda}/>
      <Inp label="Horario" optional placeholder="Ej: Lunes a viernes 8 a 17 hs" value={hor} onChange={setHor}/>
      <ToggleSeguro pais={data.pais} value={seguro} onChange={setSeguro}/>
      <Btn onClick={next} disabled={!disp}>Ver resumen</Btn>
    </div>
  );
};

const StepEmp1 = ({data,set,onNext}) => {
  const [foto,setFoto] = useState(data.foto||"");
  const [emp,setEmp] = useState(data.empresa||"");
  const [con,setCon] = useState(data.contacto||"");
  const [em,setEm] = useState(data.email||"");
  const [tel,setTel] = useState(data.tel||"");
  const [rub,setRub] = useState(data.rubro||"");
  const [geo,setGeo] = useState({pais:data.pais||"",provincia:data.provincia||"",ciudad:data.ciudad||""});
  const emailOkEmp = em.includes("@") && em.includes(".");
  const ok = emp && con && emailOkEmp && geo.ciudad;
  const init = emp ? emp.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "??";
  const next = () => { set({...data,foto,empresa:emp,contacto:con,email:em,tel,rubro:rub,...geo}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Datos de tu empresa</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Los profesionales verán este perfil</div>
      <FotoPicker foto={foto} onFoto={setFoto} color="#1a1a2e" init={init} size={80}/>
      <Inp label="Empresa *" placeholder="Ej: Constructora Omega S.A." value={emp} onChange={setEmp}/>
      <Inp label="Contacto *" placeholder="Tu nombre y apellido" value={con} onChange={setCon}/>
      <Inp label="Email" optional type="email" placeholder="rrhh@empresa.com" value={em} onChange={setEm}/>
      <Inp label="Teléfono" optional placeholder="+54 11..." value={tel} onChange={setTel}/>
      <Sel label="Rubro" optional value={rub} onChange={setRub}
        options={[{v:"",l:"Seleccioná el rubro..."},...SECTORES.map(s=>({v:s,l:s}))]}/>
      <GeoSel pais={geo.pais} provincia={geo.provincia} ciudad={geo.ciudad} onChange={setGeo}/>
      <Btn onClick={next} disabled={!ok}>Continuar</Btn>
    </div>
  );
};

const StepEmp2 = ({data,set,onNext}) => {
  const [tipo,setTipo] = useState(data.tipoBusqueda||"");
  const [mod,setMod] = useState(data.modalidad||"");
  const [sec,setSec] = useState(data.sectorObra||"");
  const [zona,setZona] = useState(data.zonaObra||"");
  const [rad,setRad] = useState(data.radio||25);
  const [dias,setDias] = useState(data.dias||[]);
  const [pres,setPres] = useState(data.presupuesto||"");
  const [mon,setMon] = useState(data.moneda||"ARS");
  const [seguro,setSeguro] = useState(data.seguro!==undefined?data.seguro:null);
  const ok = tipo && mod;
  const next = () => { set({...data,tipoBusqueda:tipo,modalidad:mod,sectorObra:sec,zonaObra:zona,radio:rad,dias,presupuesto:pres,moneda:mon,seguro}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Qué profesional buscás</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Filtramos los candidatos más relevantes</div>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:8}}>Título requerido *</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {[{v:"est",l:"Estudiante"},{v:"tec",l:"Técnico"},{v:"lic",l:"Licenciado"},
            {v:"ing",l:"Ingeniero"},{v:"cualquiera",l:"Cualquiera"}].map(({v,l})=>(
            <Chip key={v} selected={tipo===v} onClick={()=>setTipo(v)}>{l}</Chip>
          ))}
        </div>
      </div>
      <Sel label="Modalidad *" value={mod} onChange={setMod}
        options={[{v:"",l:"Seleccioná..."},{v:"puntual",l:"Obra / trabajo puntual"},
          {v:"part",l:"Part-time"},{v:"full",l:"Full-time / dependencia"},
          {v:"dias",l:"Por días sueltos"},{v:"cualquiera",l:"Cualquier modalidad"}]}/>
      <Sel label="Sector" optional value={sec} onChange={setSec}
        options={[{v:"",l:"Seleccioná..."},...SECTORES.map(s=>({v:s,l:s}))]}/>
      <Inp label="Zona de trabajo" optional placeholder="Ej: Palermo, CABA" value={zona} onChange={setZona}/>
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>
            Radio de búsqueda <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>Opcional</span>
          </label>
          <span style={{fontSize:14,fontWeight:800,color:"#1a1a2e",background:"#f0f0f8",
            padding:"3px 10px",borderRadius:99}}>{rad} km</span>
        </div>
        <input type="range" min={5} max={200} step={5} value={rad}
          onChange={e=>setRad(Number(e.target.value))}
          style={{width:"100%",accentColor:"#1a1a2e",height:4}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#aaa",marginTop:4}}>
          <span>5 km</span>
          <span>100 km</span>
          <span>200 km</span>
        </div>
      </div>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:8}}>
          Días <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>Opcional</span>
        </label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {DIAS.map(d=>(
            <Chip key={d} selected={dias.includes(d)}
              onClick={()=>setDias(c=>c.includes(d)?c.filter(x=>x!==d):[...c,d])}>
              {d}
            </Chip>
          ))}
        </div>
      </div>
      <Honorarios value={pres} moneda={mon} onValue={setPres} onMoneda={setMon}/>
      <ToggleSeguro pais={data.pais} value={seguro} onChange={setSeguro} esOferta={true}/>
      <Btn onClick={next} disabled={!ok}>Continuar</Btn>
    </div>
  );
};

const StepEmp3 = ({data,set,onNext}) => {
  const [desc,setDesc] = useState(data.descripcionObra||"");
  const [sreq,setSreq] = useState(data.skillsReq||[]);
  const [urg,setUrg] = useState(data.urgencia||"");
  const next = () => { set({...data,descripcionObra:desc,skillsReq:sreq,urgencia:urg}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Describí la búsqueda</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Cuanto más detalle, mejores candidatos</div>
      <Txt label="Descripción" optional value={desc} onChange={setDesc}
        example="Obra de construcción de torre en Caballito. Buscamos Técnico para elaboración de Programa de Seguridad y recorridas diarias. Duración: 4 meses."/>
      <SkillSelector label="Skills requeridos" selected={sreq} onChange={setSreq}/>
      <Sel label="Urgencia" optional value={urg} onChange={setUrg}
        options={[{v:"",l:"Seleccioná..."},{v:"ya",l:"Urgente — necesito alguien ya"},
          {v:"semana",l:"Esta semana"},{v:"mes",l:"En el próximo mes"}]}/>
      <Btn onClick={next}>Ver resumen</Btn>
    </div>
  );
};

const Resumen = ({rol,data,onConfirm}) => {
  const esPro = rol==="profesional";
  const init = esPro
    ? ((data.nombre||"?")[0]+(data.apellido||"?")[0]).toUpperCase()
    : (data.empresa||"??").slice(0,2).toUpperCase();
  const sym = data.moneda==="USD"?"U$D":"$";
  const val = data.tarifa||data.presupuesto;
  const tit = TITULOS[data.titulo]||"";
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Perfil listo!</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Revisá todo antes de entrar a Safy</div>
      <div style={{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:14}}>
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
          <Av init={init} color="#1a1a2e" size={60} foto={data.foto||""}/>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e"}}>
              {esPro?(data.nombre+" "+(data.apellido||"")).trim():data.empresa}
            </div>
            <div style={{color:"#666",fontSize:13}}>{esPro?tit:data.rubro||"Empresa"}</div>
            <div style={{fontSize:12,color:"#888",marginTop:2}}>
              {[data.ciudad,data.provincia].filter(Boolean).join(", ")||"Sin ubicación"}
            </div>
          </div>
        </div>
        {(data.descripcion||data.descripcionObra)&&(
          <p style={{fontSize:13,color:"#444",lineHeight:1.55,margin:"0 0 14px",
            padding:"10px 12px",background:"#f8f8fc",borderRadius:10}}>
            {data.descripcion||data.descripcionObra}
          </p>
        )}
        {(esPro?data.skills:data.skillsReq||[]).length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {(esPro?data.skills:data.skillsReq).slice(0,6).map((s,i)=>(
              <Chip key={i} selected>{s}</Chip>
            ))}
          </div>
        )}
        <div style={{borderTop:"1px solid #f0f0f0",paddingTop:12}}>
          <div style={{fontSize:11,color:"#999",fontWeight:600}}>
            {esPro?"TARIFA / HORA":"PRESUPUESTO MÁX / HORA"}
          </div>
          <div style={{fontSize:20,fontWeight:800,color:"#1a1a2e"}}>
            {val?(sym+Number(val).toLocaleString()+"/h"):"No indicado"}
          </div>
        </div>
      </div>
      <div style={{background:"#fffbf3",borderRadius:12,padding:"12px 14px",marginBottom:20,
        border:"1.5px solid #F4A261"}}>
        <div style={{fontSize:12,color:"#b45309"}}>
          Podés editar tu perfil en cualquier momento desde Mi Perfil
        </div>
      </div>
      <AceptacionLegal onConfirm={onConfirm}/>
    </div>
  );
};

const Onboarding = ({onComplete, googleData}) => {
  const [step,setStep] = useState(0);
  const [rol,setRol] = useState(null);
  const [modo,setModo] = useState(null);
  const gd = googleData || {};
  const [data,setData] = useState({
    moneda:"ARS", skills:[], obras:[], sectores:[], dias:[], skillsReq:[], radio:30,
    // Pre-rellenar desde Google si está disponible
    nombre:   gd.nombre   || "",
    apellido: gd.apellido || "",
    email:    gd.email    || "",
    foto:     gd.foto     || "",
    pais:     gd.pais     || "",
    provincia:gd.provincia|| "",
    ciudad:   gd.ciudad   || "",
  });
  const totalPro=5, totalEmp=4;
  const total = rol==="profesional"?totalPro:rol==="empresa"?totalEmp:1;
  const back = () => {
    if(step===0) return;
    if(step===1&&rol==="profesional"){ setStep(0.5); return; }
    if(step===0.5){ setStep(0); setRol(null); setModo(null); return; }
    if(step<=1){ setStep(0); setRol(null); setModo(null); return; }
    setStep(s=>s-1);
  };
  const next = () => setStep(s=>s+1);
  const elegirRol = r => { setRol(r); if(r==="empresa")setStep(1); else setStep(0.5); };
  const elegirModo = m => { setModo(m); setData(d=>({...d,modoProfesional:m})); setStep(1); };
  return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",
      minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto"}}>
      <style>{CSS}</style>
      {step===0?(
        <div style={{background:"#1a1a2e",padding:"18px 20px 14px",flexShrink:0}}>
          <div style={{fontWeight:800,fontSize:22,color:"#fff",letterSpacing:-.5}}>
            S<span style={{color:"#F4A261"}}>afy</span>
          </div>
        </div>
      ):step===0.5?(
        <div style={{background:"#1a1a2e",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <button onClick={back}
            style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,fontFamily:"inherit"}}>
            ‹
          </button>
          <span style={{flex:1,fontWeight:800,fontSize:18,color:"#fff"}}>
            S<span style={{color:"#F4A261"}}>afy</span>
          </span>
        </div>
      ):<OBHead step={step} total={total} onBack={back}/>}
      <div style={{flex:1,overflowY:"auto"}}>
        {step===0&&(
          <div style={{display:"flex",flexDirection:"column",gap:14,padding:"32px 20px"}}>
            <div style={{textAlign:"center",marginBottom:8}}>
              <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:6}}>Quién sos?</div>
              <div style={{color:"#666",fontSize:14,lineHeight:1.5}}>Elegí tu rol para personalizar Safy</div>
            </div>
            {[{r:"profesional",e:"Soy profesional de SyH / MA",
               d:"Técnico, Licenciado, Ingeniero o Estudiante buscando oportunidades"},
              {r:"empresa",e:"Soy empresa / contratista",
               d:"Empresa o constructora que busca profesionales para obras o proyectos"}].map(({r,e,d})=>(
              <button key={r} onClick={()=>elegirRol(r)}
                style={{background:"#fff",border:"2px solid #e0e0ef",borderRadius:16,
                  padding:20,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}
                onMouseEnter={el=>{el.currentTarget.style.borderColor="#1a1a2e";el.currentTarget.style.background="#f8f8fc"}}
                onMouseLeave={el=>{el.currentTarget.style.borderColor="#e0e0ef";el.currentTarget.style.background="#fff"}}>
                <div style={{fontWeight:800,fontSize:16,color:"#1a1a2e",marginBottom:4}}>{e}</div>
                <div style={{fontSize:13,color:"#666",lineHeight:1.4}}>{d}</div>
              </button>
            ))}
          </div>
        )}
        {step===0.5&&(
          <div style={{display:"flex",flexDirection:"column",gap:14,padding:"32px 20px"}}>
            <div style={{textAlign:"center",marginBottom:8}}>
              <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:6}}>Qué querés hacer?</div>
            </div>
            {[{m:"candidato",e:"Crear mi perfil como candidato",d:"Para que las empresas te encuentren"},
              {m:"busqueda",e:"Publicar una búsqueda",d:"Buscás un profesional para una obra puntual"},
              {m:"ambos",e:"Las dos cosas",d:"Perfil de candidato y publicar búsqueda"}].map(({m,e,d})=>(
              <button key={m} onClick={()=>elegirModo(m)}
                style={{background:"#fff",border:"2px solid #e0e0ef",borderRadius:16,
                  padding:20,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}
                onMouseEnter={el=>{el.currentTarget.style.borderColor="#1a1a2e";el.currentTarget.style.background="#f8f8fc"}}
                onMouseLeave={el=>{el.currentTarget.style.borderColor="#e0e0ef";el.currentTarget.style.background="#fff"}}>
                <div style={{fontWeight:800,fontSize:15,color:"#1a1a2e",marginBottom:4}}>{e}</div>
                <div style={{fontSize:13,color:"#666",lineHeight:1.4}}>{d}</div>
              </button>
            ))}
          </div>
        )}
        {rol==="profesional"&&step>=1&&(
          <>
            {step===1&&<StepPro1 data={data} set={setData} onNext={next}/>}
            {step===2&&<StepPro2 data={data} set={setData} onNext={next}/>}
            {step===3&&<StepPro3 data={data} set={setData} onNext={next}/>}
            {step===4&&<StepPro4 data={data} set={setData} onNext={next}/>}
            {step===5&&<Resumen rol={rol} data={data} onConfirm={()=>onComplete(rol,data)}/>}
          </>
        )}
        {rol==="empresa"&&step>=1&&(
          <>
            {step===1&&<StepEmp1 data={data} set={setData} onNext={next}/>}
            {step===2&&<StepEmp2 data={data} set={setData} onNext={next}/>}
            {step===3&&<StepEmp3 data={data} set={setData} onNext={next}/>}
            {step===4&&<Resumen rol={rol} data={data} onConfirm={()=>onComplete(rol,data)}/>}
          </>
        )}
      </div>
    </div>
  );
};

// ─── CHAT ─────────────────────────────────────────────────────────────────────

const ChatWindow = ({match,userData,onClose}) => {
  const chatKey = (match&&match.id) ? String(match.id) : "default";
  const initMsg = [{from:"them",text:"Hola, vi tu perfil en Safy. Me interesa tu experiencia. Podemos coordinar?",time:"10:32"}];
  const [historial,setHistorial] = useState({});
  const msgs = historial[chatKey]||initMsg;
  const setMsgs = fn => setHistorial(h=>{
    const prev = h[chatKey]||initMsg;
    return {...h,[chatKey]:typeof fn==="function"?fn(prev):fn};
  });
  const [input,setInput] = useState("");
  const myInit = userData.nombre
    ? (userData.nombre[0]+(userData.apellido||" ")[0]).toUpperCase()
    : (userData.empresa||"??").slice(0,2).toUpperCase();
  const send = () => {
    if(!input.trim()) return;
    const now = new Date();
    const t = now.getHours()+":"+String(now.getMinutes()).padStart(2,"0");
    setMsgs(m=>[...m,{from:"me",text:input.trim(),time:t}]);
    setInput("");
    const rs=["Que días tenés disponibles?","Podés enviarme tu CV?","Cuál es tu tarifa?","Te mando más detalles.","Tenés experiencia en el sector?"];
    setTimeout(()=>{
      const now2=new Date();
      const t2=now2.getHours()+":"+String(now2.getMinutes()).padStart(2,"0");
      setMsgs(m=>[...m,{from:"them",text:rs[Math.floor(Math.random()*rs.length)],time:t2}]);
    },1200);
  };
  return (
    <div style={{position:"fixed",inset:0,background:"#f0f0f8",zIndex:800,
      display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto",animation:"slideUp .25s ease"}}>
      <div style={{background:"#1a1a2e",padding:"14px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose}
          style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,fontFamily:"inherit"}}>
          ‹
        </button>
        <Av init={match.avatar} color={match.color} size={38}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{match.nombre||match.empresa}</div>
          <div style={{fontSize:11,color:"#aaa"}}>{TITULOS[match.titulo]||match.tipo||""} · {match.ciudad}</div>
        </div>
        <div style={{background:"rgba(42,157,143,0.2)",borderRadius:99,padding:"4px 10px",fontSize:11,color:"#2A9D8F",fontWeight:700}}>
          Conectados
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{textAlign:"center",fontSize:11,color:"#aaa",marginBottom:4}}>Conexión en Safy</div>
        {msgs.map((m,i)=>{
          const isMe = m.from==="me";
          return (
            <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
              {!isMe&&<Av init={match.avatar} color={match.color} size={28}/>}
              <div style={{maxWidth:"75%"}}>
                <div style={{background:isMe?"#1a1a2e":"#fff",color:isMe?"#fff":"#1a1a2e",
                  padding:"10px 14px",
                  borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  fontSize:14,lineHeight:1.4,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
                  {m.text}
                </div>
                <div style={{fontSize:10,color:"#aaa",marginTop:3,textAlign:isMe?"right":"left"}}>{m.time}</div>
              </div>
              {isMe&&<Av init={myInit} color="#1a1a2e" size={28}/>}
            </div>
          );
        })}
      </div>
      <div style={{background:"#fff",padding:"12px 14px",borderTop:"1px solid #ebebeb",
        display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Escribí un mensaje..."
          style={{flex:1,padding:"11px 14px",borderRadius:99,border:"1.5px solid #e0e0ef",
            fontSize:14,outline:"none",background:"#f8f8fc"}}/>
        <button onClick={send}
          style={{width:42,height:42,borderRadius:"50%",background:"#1a1a2e",border:"none",
            color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",
            justifyContent:"center",fontFamily:"inherit"}}>
          ›
        </button>
      </div>
    </div>
  );
};

// ─── RATING STARS ────────────────────────────────────────────────────────────
const RatingStars = ({rating, trabajos, canRate, onRate}) => {
  const [hover,       setHover]       = useState(0);
  const [selected,    setSelected]    = useState(0);
  const [showPanel,   setShowPanel]   = useState(false);
  const [comment,     setComment]     = useState("");
  const [done,        setDone]        = useState(false);

  const existing = rating ? Math.round(rating) : 0;
  const active   = hover || selected || existing;
  const labels   = ["","Muy mala","Mala","Regular","Buena","Excelente"];

  const handlePick = (n) => {
    if(!canRate) return;
    setSelected(n);
    setHover(0);
    setShowPanel(true);
  };

  const handleSend = () => {
    if(onRate) onRate({stars: selected, comentario: comment});
    setDone(true);
    setShowPanel(false);
  };

  const handleCancel = () => {
    setShowPanel(false);
    setSelected(0);
    setComment("");
  };

  return (
    <div style={{marginTop:4}}>

      {/* Fila de estrellas */}
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4}}>
          {[1,2,3,4,5].map(n => {
            const lit = done ? n<=selected : n<=active;
            return (
              <span key={n}
                onMouseEnter={()=>{ if(canRate&&!done) setHover(n); }}
                onMouseLeave={()=>{ if(canRate&&!done) setHover(0); }}
                onTouchStart={()=>{ if(canRate&&!done) setHover(n); }}
                onTouchEnd={()=>{ if(canRate&&!done){ handlePick(n); setHover(0); } }}
                onClick={()=>{ if(canRate&&!done) handlePick(n); }}
                style={{
                  fontSize:26,
                  color: lit ? "#F4A261" : "#d0d0d0",
                  cursor: canRate&&!done ? "pointer" : "default",
                  transition:"color .12s, transform .1s",
                  transform: canRate&&!done&&n<=hover ? "scale(1.25)" : "scale(1)",
                  display:"inline-block",
                  userSelect:"none",
                  WebkitUserSelect:"none",
                  lineHeight:1,
                }}>
                ★
              </span>
            );
          })}
        </div>

        {/* Número de rating + trabajos */}
        {rating&&!done&&(
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{rating}</span>
            {trabajos&&<span style={{fontSize:12,color:"#aaa"}}>({trabajos} trabajos)</span>}
          </div>
        )}

        {/* Label hover */}
        {canRate&&!done&&hover>0&&(
          <span style={{fontSize:12,color:"#F4A261",fontWeight:600}}>{labels[hover]}</span>
        )}

        {/* Confirmación enviada */}
        {done&&(
          <span style={{fontSize:12,color:"#2A9D8F",fontWeight:600}}>Valoración enviada ✓</span>
        )}
      </div>

      {/* Hint cuando puede valorar y no hay hover */}
      {canRate&&!done&&hover===0&&selected===0&&(
        <div style={{fontSize:11,color:"#aaa",marginTop:4}}>
          Tocá las estrellas para valorar
        </div>
      )}

      {/* Panel de comentario inline */}
      {showPanel&&(
        <div style={{marginTop:12,background:"#fffbf3",borderRadius:14,padding:"14px 16px",
          border:"1.5px solid #F4A261"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>
              {selected} {selected===1?"estrella":"estrellas"} · {labels[selected]}
            </div>
            <button onClick={handleCancel}
              style={{background:"none",border:"none",fontSize:20,color:"#aaa",
                cursor:"pointer",fontFamily:"inherit",lineHeight:1,padding:0}}>
              ×
            </button>
          </div>
          <textarea
            value={comment}
            onChange={e=>setComment(e.target.value)}
            placeholder="Comentario opcional..."
            rows={2}
            style={{width:"100%",padding:"10px 12px",borderRadius:10,
              border:"1.5px solid #e0e0ef",fontSize:13,color:"#1a1a2e",outline:"none",
              resize:"none",boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit",
              marginBottom:10}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleCancel}
              style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #e0e0ef",
                background:"#fff",color:"#888",fontWeight:600,fontSize:13,
                cursor:"pointer",fontFamily:"inherit"}}>
              Cancelar
            </button>
            <button onClick={handleSend}
              style={{flex:2,padding:"9px 0",borderRadius:10,border:"none",
                background:"#1a1a2e",color:"#fff",fontWeight:700,fontSize:13,
                cursor:"pointer",fontFamily:"inherit"}}>
              Enviar ★
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


// ─── PERFIL COMPLETO ──────────────────────────────────────────────────────────

const PerfilCompleto = ({persona,onClose,onChat,onValorar,onReportar}) => {
  const esPro = !!persona.nombre;
  const init = esPro
    ? (persona.nombre[0]+((persona.apellido||" ")[0])).toUpperCase()
    : (persona.empresa||"??").slice(0,2).toUpperCase();
  const nombreDisplay = esPro
    ? (persona.nombre+" "+(persona.apellido||"")).trim()
    : persona.empresa;
  const tituloDisplay = TITULOS[persona.titulo]||persona.tipo||"";
  const rating = persona.rating||null;
  const stars = rating?Math.round(rating):0;
  return (
    <div style={{position:"fixed",inset:0,background:"#f0f0f8",zIndex:700,
      display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto",
      animation:"slideUp .25s ease",overflowY:"auto"}}>
      <div style={{background:"#1a1a2e",padding:"14px 20px",display:"flex",
        alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10,flexShrink:0}}>
        <button onClick={onClose}
          style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,fontFamily:"inherit"}}>
          ‹
        </button>
        <div style={{flex:1,fontWeight:800,fontSize:16,color:"#fff"}}>Perfil completo</div>
        {onChat&&(
          <button onClick={onChat}
            style={{background:"#F4A261",border:"none",borderRadius:99,padding:"7px 14px",
              fontWeight:700,fontSize:12,color:"#1a1a2e",cursor:"pointer",fontFamily:"inherit"}}>
            Chatear
          </button>
        )}
      </div>
      <div style={{padding:"16px 16px 40px"}}>
        <div style={{background:"#fff",borderRadius:20,padding:20,
          boxShadow:"0 2px 16px rgba(0,0,0,0.09)",marginBottom:14}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:16}}>
            <Av init={init} color={persona.color||"#1a1a2e"} size={72} foto={persona.foto||""}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <div style={{fontWeight:800,fontSize:19,color:"#1a1a2e",lineHeight:1.2,flex:1}}>
                  {nombreDisplay}
                </div>
                {onReportar&&(
                  <button onClick={onReportar}
                    title="Reportar o bloquear"
                    style={{background:"none",border:"none",fontSize:18,cursor:"pointer",
                      padding:"2px 4px",lineHeight:1,flexShrink:0,opacity:0.6}}>
                    🚩
                  </button>
                )}
              </div>
              {tituloDisplay&&(
                <div style={{fontSize:13,color:"#666",marginBottom:4}}>{tituloDisplay}</div>
              )}
              {(persona.ciudad||persona.provincia)&&(
                <div style={{fontSize:12,color:"#888",marginBottom:6}}>
                  {[persona.ciudad,persona.provincia].filter(Boolean).join(", ")}
                </div>
              )}
              {/* Estrellas interactivas — siempre visibles si hay conexión (onChat), de lo contrario solo si hay rating */}
              {(rating||onValorar)&&(
                <RatingStars
                  rating={rating}
                  trabajos={persona.trabajos}
                  canRate={!!onValorar}
                  onRate={onValorar}/>
              )}
            </div>
          </div>
          {persona.disponibilidad&&(
            <div style={{marginBottom:14}}>
              {persona.disponibilidad==="disponible"&&(
                <span style={{background:"#e8f7f5",color:"#2A9D8F",padding:"4px 12px",borderRadius:99,fontSize:12,fontWeight:700}}>Disponible ahora</span>
              )}
              {persona.disponibilidad==="parcial"&&(
                <span style={{background:"#fff3e0",color:"#F4A261",padding:"4px 12px",borderRadius:99,fontSize:12,fontWeight:700}}>Disponibilidad parcial</span>
              )}
              {persona.disponibilidad==="no"&&(
                <span style={{background:"#fdecea",color:"#E63946",padding:"4px 12px",borderRadius:99,fontSize:12,fontWeight:700}}>No disponible</span>
              )}
            </div>
          )}
          {(persona.perfil||persona.descripcion||persona.descripcionObra)&&(
            <div style={{background:"#f8f8fc",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
              <p style={{fontSize:13,color:"#444",lineHeight:1.6,margin:0}}>
                {persona.perfil||persona.descripcion||persona.descripcionObra}
              </p>
            </div>
          )}
          {(persona.tarifa||persona.presupuesto)&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              paddingTop:14,borderTop:"1px solid #f0f0f0"}}>
              <div>
                <div style={{fontSize:11,color:"#aaa",fontWeight:600,marginBottom:2}}>TARIFA / HORA</div>
                <div style={{fontSize:24,fontWeight:800,color:"#1a1a2e"}}>
                  {persona.moneda==="USD"?"U$D":"$"}{Number(persona.tarifa||persona.presupuesto).toLocaleString()}
                  <span style={{fontSize:13,color:"#888",fontWeight:400}}>/h</span>
                </div>
              </div>
              {persona.distancia!=null&&(
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:"#aaa",fontWeight:600,marginBottom:2}}>DISTANCIA</div>
                  <div style={{fontSize:20,fontWeight:800,color:"#1a1a2e"}}>{persona.distancia} km</div>
                </div>
              )}
            </div>
          )}
        </div>
        {(persona.skills||[]).length>0&&(
          <div style={{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Skills</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {persona.skills.map((s,i)=><Chip key={i}>{s}</Chip>)}
            </div>
          </div>
        )}
        {(persona.obras||[]).length>0&&(
          <div style={{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Obras y proyectos</div>
            {persona.obras.map((o,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 0",borderBottom:i<persona.obras.length-1?"1px solid #f5f5f5":"none"}}>
                <span style={{fontSize:13,color:"#444"}}>{o}</span>
              </div>
            ))}
          </div>
        )}
        {(persona.email||persona.tel)&&(
          <div style={{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:10}}>Contacto</div>
            {persona.email&&<div style={{fontSize:13,color:"#1a73e8",fontWeight:600,marginBottom:6}}>{persona.email}</div>}
            {persona.tel&&<div style={{fontSize:13,color:"#1a1a2e",fontWeight:600}}>{persona.tel}</div>}
          </div>
        )}
        {onChat&&(
          <button onClick={onChat}
            style={{width:"100%",padding:15,borderRadius:14,border:"none",background:"#1a1a2e",
              color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
            Iniciar conversación
          </button>
        )}
      </div>
    </div>
  );
};

// ─── VALORACIÓN ───────────────────────────────────────────────────────────────

const ModalValoracion = ({match,onSubmit,onClose}) => {
  const [hover,setHover] = useState(0);
  const labels = ["","Muy mala","Mala","Regular","Buena","Excelente"];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,.88)",zIndex:900,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"28px 24px 36px",
        width:"100%",maxWidth:420,animation:"slideUp .25s ease"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:"center",marginBottom:6}}>
          <div style={{fontWeight:800,fontSize:18,color:"#1a1a2e",marginBottom:4}}>
            ¿Cómo fue tu experiencia?
          </div>
          <div style={{fontSize:13,color:"#888"}}>
            {match.empresa||match.nombre}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:24,marginBottom:12}}>
          {[1,2,3,4,5].map(n=>(
            <button key={n}
              onMouseEnter={()=>setHover(n)}
              onMouseLeave={()=>setHover(0)}
              onClick={()=>{ onSubmit({stars:n}); onClose(); }}
              style={{background:"none",border:"none",fontSize:44,cursor:"pointer",
                color:hover>=n?"#F4A261":"#e0e0ef",fontFamily:"inherit",
                transform:hover>=n?"scale(1.2)":"scale(1)",
                transition:"transform .1s, color .15s",lineHeight:1}}>
              ★
            </button>
          ))}
        </div>
        <div style={{textAlign:"center",fontSize:14,fontWeight:700,color:"#F4A261",minHeight:22}}>
          {labels[hover]||"Tocá para valorar"}
        </div>
      </div>
    </div>
  );
};

// ─── ELIMINAR CUENTA ─────────────────────────────────────────────────────────

const EliminarCuentaSection = ({onConfirm}) => {
  const [paso,setPaso] = useState(0);

  useEffect(()=>{
    if(paso===2){
      const t = setTimeout(()=>onConfirm(), 2500);
      return ()=>clearTimeout(t);
    }
  },[paso]);

  if(paso===2) return (
    <div style={{textAlign:"center",padding:"24px 0 8px"}}>
      <div style={{fontSize:32,marginBottom:8}}>👋</div>
      <div style={{fontSize:14,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>Cuenta eliminada</div>
      <div style={{fontSize:12,color:"#aaa",marginTop:4}}>Redirigiendo...</div>
    </div>
  );

  if(paso===1) return (
    <div style={{borderTop:"1px solid #f0f0f0",paddingTop:20,marginTop:8}}>
      <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:6}}>Estás seguro?</div>
      <div style={{fontSize:12,color:"#888",lineHeight:1.5,marginBottom:16}}>
        Esta acción elimina tu perfil, conexiones y toda tu información. No se puede deshacer.
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setPaso(0)}
          style={{flex:1,padding:"11px 0",borderRadius:12,border:"1.5px solid #e0e0ef",
            background:"#fff",color:"#555",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Cancelar
        </button>
        <button onClick={()=>setPaso(2)}
          style={{flex:1,padding:"11px 0",borderRadius:12,border:"none",background:"#E63946",
            color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Sí, eliminar
        </button>
      </div>
    </div>
  );

  return (
    <div style={{paddingTop:16,marginTop:8,textAlign:"center"}}>
      <button onClick={()=>setPaso(1)}
        style={{background:"none",border:"none",color:"#bbb",fontSize:12,cursor:"pointer",
          fontFamily:"inherit",textDecoration:"underline"}}>
        Eliminar mi cuenta
      </button>
    </div>
  );
};
// ─── EDITAR CUENTA ────────────────────────────────────────────────────────────

const EditarCuenta = ({userData,userRol,onSave,onClose,onLogout,verificado,onVerificar,onCancelarVerif}) => {
  const [d,setD] = useState({...userData});
  const esPro = userRol==="profesional";
  const upd = (k,v) => setD(p=>({...p,[k]:v}));
  const DC = {disponible:"#2A9D8F",obra:"#F4A261",parcial:"#F4A261",no:"#E63946"};
  return (
    <div style={{position:"fixed",inset:0,background:"#f0f0f8",zIndex:500,
      display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto",overflowY:"auto"}}>
      <div style={{background:"#1a1a2e",padding:"16px 20px",display:"flex",alignItems:"center",
        gap:14,position:"sticky",top:0,zIndex:10}}>
        <button onClick={onClose}
          style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,fontFamily:"inherit"}}>
          ‹
        </button>
        <div style={{flex:1,fontWeight:800,fontSize:17,color:"#fff"}}>Configurar cuenta</div>
        <button onClick={()=>onSave(d)}
          style={{background:"#F4A261",border:"none",borderRadius:99,padding:"7px 16px",
            fontWeight:800,fontSize:13,color:"#1a1a2e",cursor:"pointer",fontFamily:"inherit"}}>
          Guardar
        </button>
      </div>
      <div style={{padding:"20px 20px 40px"}}>
        {esPro&&(
          <div style={{background:"#fff",borderRadius:16,padding:18,marginBottom:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
            <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:12}}>Estado de disponibilidad</div>
            {[{v:"disponible",t:"Disponible ahora",desc:"Aparecés primero"},
              {v:"obra",t:"En obra actualmente",desc:"Disponibilidad limitada"},
              {v:"parcial",t:"Disponibilidad parcial",desc:"Acepto proyectos puntuales"},
              {v:"no",t:"No disponible",desc:"No acepto nuevas propuestas"}].map(({v,t,desc})=>(
              <button key={v} onClick={()=>upd("disponibilidad",v)}
                style={{width:"100%",marginBottom:8,
                  background:d.disponibilidad===v?"#f0f0f8":"#fff",
                  border:d.disponibilidad===v?"2px solid #1a1a2e":"2px solid #e8e8f0",
                  borderRadius:12,padding:"11px 14px",textAlign:"left",cursor:"pointer",
                  display:"flex",gap:10,alignItems:"center",fontFamily:"inherit"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{t}</div>
                  <div style={{fontSize:11,color:"#888"}}>{desc}</div>
                </div>
                {d.disponibilidad===v&&<span style={{color:"#1a1a2e",fontSize:18}}>✓</span>}
              </button>
            ))}
          </div>
        )}
        <div style={{background:"#fff",borderRadius:16,padding:18,marginBottom:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:14}}>Foto de perfil</div>
          <FotoPicker foto={d.foto||""} onFoto={v=>upd("foto",v)} color="#1a1a2e"
            init={esPro
              ? ((d.nombre||"?")[0]+(d.apellido||"?")[0]).toUpperCase()
              : (d.empresa||"??").slice(0,2).toUpperCase()}
            size={80}/>
        </div>
        <div style={{background:"#fff",borderRadius:16,padding:18,marginBottom:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
          <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:14}}>Datos personales</div>
          {esPro?(
            <>
              <Inp label="Nombre" value={d.nombre||""} onChange={v=>upd("nombre",v)} placeholder="Tu nombre"/>
              <Inp label="Apellido" value={d.apellido||""} onChange={v=>upd("apellido",v)} placeholder="Tu apellido"/>
              <Inp label="Email" type="email" value={d.email||""} onChange={v=>upd("email",v)} placeholder="tu@email.com"/>
              <Inp label="Teléfono" optional value={d.tel||""} onChange={v=>upd("tel",v)} placeholder="+54 9 11..."/>
              <Inp label="Radio (km)" optional type="number" value={d.radio||""} onChange={v=>upd("radio",v)} placeholder="Ej: 30"/>
            </>
          ):(
            <>
              <Inp label="Empresa" value={d.empresa||""} onChange={v=>upd("empresa",v)} placeholder="Nombre de la empresa"/>
              <Inp label="Contacto" value={d.contacto||""} onChange={v=>upd("contacto",v)} placeholder="Nombre y apellido"/>
              <Inp label="Email" type="email" value={d.email||""} onChange={v=>upd("email",v)} placeholder="tu@empresa.com"/>
              <Inp label="Teléfono" optional value={d.tel||""} onChange={v=>upd("tel",v)} placeholder="+54 11..."/>
            </>
          )}
          <GeoSel
            pais={d.pais||""} provincia={d.provincia||""} ciudad={d.ciudad||""}
            onChange={g=>setD(p=>({...p,...g}))}/>
        </div>
        {esPro&&(
          <div style={{background:"#fff",borderRadius:16,padding:18,marginBottom:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
            <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:14}}>Honorarios</div>
            <Honorarios value={d.tarifa||""} moneda={d.moneda||"ARS"}
              onValue={v=>upd("tarifa",v)} onMoneda={v=>upd("moneda",v)}/>
            <Inp label="Horario" optional value={d.horario||""}
              onChange={v=>upd("horario",v)} placeholder="Ej: Lunes a viernes 8 a 17 hs"/>
          </div>
        )}
        <button onClick={()=>onSave(d)}
          style={{width:"100%",padding:15,borderRadius:14,border:"none",background:"#1a1a2e",
            color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",marginBottom:12,fontFamily:"inherit"}}>
          Guardar cambios
        </button>
        <button onClick={onClose}
          style={{width:"100%",padding:14,borderRadius:14,border:"1.5px solid #e0e0ef",
            background:"#fff",color:"#888",fontWeight:600,fontSize:14,cursor:"pointer",
            fontFamily:"inherit",marginBottom:32}}>
          Cancelar
        </button>
        <VerificacionSection
          verificado={verificado}
          onVerificar={onVerificar}
          onCancelar={onCancelarVerif}
          esEmpresa={userRol==="empresa"}/>
        <EliminarCuentaSection onConfirm={onLogout||onClose}/>
      </div>
    </div>
  );
};

// ─── SWIPE CARD ───────────────────────────────────────────────────────────────

const SwipeCard = ({item,type,onSwipe,isTop}) => {
  const [dx,setDx] = useState(0);
  const [dragging,setDragging] = useState(false);
  const [dec,setDec] = useState(null);
  const sx = useRef(null);
  const start = cx => { if(!isTop)return; sx.current=cx; setDragging(true); };
  const move  = cx => {
    if(!dragging||!sx.current)return;
    const d=cx-sx.current; setDx(d);
    setDec(d>60?"yes":d<-60?"no":null);
  };
  const end = () => {
    if(!dragging)return;
    if(dx>80)onSwipe("yes"); else if(dx<-80)onSwipe("no");
    else{setDx(0);setDec(null);}
    setDragging(false); sx.current=null;
  };
  const isPro = type==="profesional";
  const p = item;
  const sym = p.moneda==="USD"?"U$D":"$";
  return (
    <div
      onMouseDown={e=>start(e.clientX)} onMouseMove={e=>move(e.clientX)}
      onMouseUp={end} onMouseLeave={end}
      onTouchStart={e=>start(e.touches[0].clientX)}
      onTouchMove={e=>move(e.touches[0].clientX)} onTouchEnd={end}
      style={{position:"absolute",width:"100%",userSelect:"none",touchAction:"none",
        transform:"translateX("+dx+"px) rotate("+(dx/18)+"deg)",
        transition:dragging?"none":"transform .3s ease",
        opacity:1-Math.abs(dx)/500,cursor:isTop?"grab":"default"}}>
      {dec==="yes"&&(
        <div style={{position:"absolute",top:24,left:24,zIndex:10,padding:"8px 20px",
          borderRadius:8,border:"3px solid #2A9D8F",color:"#2A9D8F",fontWeight:800,
          fontSize:22,transform:"rotate(-12deg)",background:"#fff"}}>
          INTERESA
        </div>
      )}
      {dec==="no"&&(
        <div style={{position:"absolute",top:24,right:24,zIndex:10,padding:"8px 20px",
          borderRadius:8,border:"3px solid #E63946",color:"#E63946",fontWeight:800,
          fontSize:22,transform:"rotate(12deg)",background:"#fff"}}>
          PASAR
        </div>
      )}
      <div style={{background:"#fff",borderRadius:20,overflow:"hidden",
        boxShadow:isTop?"0 8px 40px rgba(0,0,0,0.18)":"0 4px 16px rgba(0,0,0,0.08)"}}>
        <div style={{height:8,background:p.color}}/>
        <div style={{padding:"20px 20px 16px"}}>
          <div style={{display:"flex",gap:14,marginBottom:14}}>
            <Av init={p.avatar} color={p.color} size={60} foto={p.foto||""}/>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e"}}>
                    {isPro?(p.nombre+" "+(p.apellido||"")).trim():p.empresa}
                  </div>
                  <div style={{color:"#666",fontSize:13}}>{isPro?TITULOS[p.titulo]:p.tipo}</div>
                </div>
                {isPro&&(
                  <Chip selected color={p.disponible?"#2A9D8F":"#999"}>
                    {p.disponible?"Disponible":"No disp."}
                  </Chip>
                )}
                {!isPro&&p.urgente&&<Chip selected color="#E63946">URGENTE</Chip>}
              </div>
              <div style={{fontSize:12,color:"#555",marginTop:5}}>
                {p.ciudad}{(p.distanciaReal!=null) ? ` · ${p.distanciaReal} km de vos` : p.distancia ? ` · ${p.distancia} km` : ""}
              </div>
              {isPro&&p.rating&&(
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                  {[1,2,3,4,5].map(n=>(
                    <span key={n} style={{fontSize:12,color:n<=Math.round(p.rating)?"#F4A261":"#e0e0ef"}}>★</span>
                  ))}
                  <span style={{fontSize:12,fontWeight:700,color:"#1a1a2e"}}>{p.rating}</span>
                </div>
              )}
            </div>
          </div>
          <p style={{color:"#444",fontSize:13,lineHeight:1.55,margin:"0 0 12px"}}>
            {isPro?p.perfil:p.descripcion}
          </p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {(isPro?p.skills:p.requisitos).map((s,i)=><Chip key={i}>{s}</Chip>)}
          </div>
          {isPro&&(
            <div style={{background:"#f8f8fc",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"#aaa",marginBottom:5}}>OBRAS</div>
              {p.obras.map((o,i)=>(
                <div key={i} style={{fontSize:12,color:"#444",padding:"2px 0"}}>· {o}</div>
              ))}
            </div>
          )}
          {!isPro&&(
            <div style={{background:"#f8f8fc",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
              <div style={{fontSize:12,color:"#444"}}>Duración: {p.duracion}</div>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            paddingTop:12,borderTop:"1px solid #f0f0f0"}}>
            <div>
              <span style={{fontSize:22,fontWeight:800,color:"#1a1a2e"}}>
                {sym}{(isPro?p.tarifa:p.presupuesto).toLocaleString()}
              </span>
              <span style={{fontSize:13,color:"#888",marginLeft:4}}>/h · {p.moneda}</span>
            </div>
            {isPro&&p.trabajos&&(
              <span style={{fontSize:12,color:"#888"}}>{p.trabajos} trabajos</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FeedItem = ({obra,onPostular,yaPostulado}) => {
  const [shareOpen,setShareOpen] = useState(false);
  const [copied,setCopied]       = useState(false);
  const sym = obra.moneda==="USD"?"U$D":"$";
  return (
    <div style={{background:"#fff",borderRadius:16,marginBottom:14,overflow:"hidden",
      boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
      <div style={{height:5,background:obra.color}}/>
      <div style={{padding:16}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
          <Av init={obra.avatar} color={obra.color} size={46}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e"}}>{obra.empresa}</div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                {obra.urgente&&<Chip selected color="#E63946">URGENTE</Chip>}
                {obra.esAdmin&&(
                  <span style={{background:"#fff3e0",color:"#F4A261",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:99}}>
                    Safy
                  </span>
                )}
              </div>
            </div>
            <div style={{color:"#888",fontSize:12}}>{obra.tipo} · {obra.ciudad}</div>
          </div>
        </div>
        <p style={{fontSize:13,color:"#444",lineHeight:1.5,margin:"0 0 10px"}}>{obra.descripcion}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
          {obra.requisitos.map((r,i)=><Chip key={i}>{r}</Chip>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:20,fontWeight:800,color:"#1a1a2e"}}>{sym}{obra.presupuesto.toLocaleString()}</span>
            <span style={{fontSize:12,color:"#888"}}>/h · {obra.moneda} · {obra.distancia}km</span>
          </div>
          <button onClick={()=>!yaPostulado&&onPostular(obra)}
            style={{background:yaPostulado?"#e8f7f5":"#1a1a2e",
              color:yaPostulado?"#2A9D8F":"#fff",border:"none",borderRadius:99,
              padding:"8px 16px",fontWeight:700,fontSize:13,
              cursor:yaPostulado?"default":"pointer",fontFamily:"inherit"}}>
            {yaPostulado?"Enviado":"Postularme"}
          </button>
          {/* Compartir */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShareOpen(!shareOpen)}
              style={{width:36,height:36,borderRadius:"50%",border:"1.5px solid #e0e0ef",
                background:"#fff",cursor:"pointer",fontSize:16,display:"flex",
                alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>
              ↗
            </button>
            {shareOpen&&(
              <div style={{position:"absolute",bottom:"110%",right:0,
                background:"#fff",borderRadius:14,padding:8,
                boxShadow:"0 4px 20px rgba(0,0,0,0.15)",zIndex:100,
                minWidth:180,border:"1px solid #f0f0f0"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#aaa",
                  padding:"4px 10px 8px",textTransform:"uppercase",letterSpacing:.5}}>
                  Compartir
                </div>
                {[
                  {icon:"🔗",label:"Copiar link",action:()=>{
                    navigator.clipboard&&navigator.clipboard.writeText("https://safy.app/oportunidad/"+obra.id);
                    setShareOpen(false);setCopied(true);setTimeout(()=>setCopied(false),2000);
                  }},
                  {icon:"💬",label:"WhatsApp",action:()=>{
                    window.open("https://wa.me/?text="+encodeURIComponent(
                      "Mirá esta oportunidad en Safy: "+obra.empresa+" busca en "+obra.ciudad+". https://safy.app/oportunidad/"+obra.id));
                    setShareOpen(false);
                  }},
                  {icon:"💼",label:"LinkedIn",action:()=>{
                    window.open("https://www.linkedin.com/sharing/share-offsite/?url="+encodeURIComponent("https://safy.app/oportunidad/"+obra.id));
                    setShareOpen(false);
                  }},
                ].map(({icon,label,action})=>(
                  <button key={label} onClick={action}
                    style={{display:"flex",alignItems:"center",gap:10,
                      width:"100%",padding:"9px 12px",borderRadius:8,
                      border:"none",background:"transparent",
                      fontSize:13,cursor:"pointer",fontFamily:"inherit",
                      color:"#1a1a2e",textAlign:"left"}}>
                    {icon} {label}
                  </button>
                ))}
                {copied&&<div style={{fontSize:11,color:"#2A9D8F",padding:"2px 12px 6px",fontWeight:600}}>✓ Link copiado</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MatchPop = ({item,userData,onClose,onGoToMatches}) => {
  const myEmail = userData.email||"—";
  const myTel   = userData.tel||"No indicado";
  const myInit = userData.nombre
    ? (userData.nombre[0]+((userData.apellido||" ")[0])).toUpperCase()
    : (userData.empresa||"??").slice(0,2).toUpperCase();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,.92)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:24,padding:28,maxWidth:340,width:"100%",
        textAlign:"center",animation:"popIn .3s ease"}}>
        <div style={{fontSize:44,marginBottom:6}}>🤝</div>
        <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:4}}>Nueva conexión!</div>
        <div style={{color:"#666",fontSize:13,marginBottom:20,lineHeight:1.5}}>
          Vos y{" "}
          <strong style={{color:"#1a1a2e"}}>{item.nombre||item.empresa}</strong>{" "}
          confirmaron interés profesional mutuo.
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:20}}>
          <Av init={myInit} color="#1a1a2e" size={52} foto={userData.foto||""}/>
          <div style={{fontSize:26}}>↔</div>
          <Av init={item.avatar} color={item.color} size={52} foto={item.foto||""}/>
        </div>
        <div style={{background:"#f8f8fc",borderRadius:14,padding:"14px 16px",marginBottom:12,textAlign:"left"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#aaa",marginBottom:8,textTransform:"uppercase"}}>
            Contacto de {item.nombre||item.empresa}
          </div>
          <div style={{fontSize:13,color:"#1a73e8",fontWeight:600,marginBottom:4}}>{item.email||"contacto@safy.app"}</div>
          <div style={{fontSize:13,color:"#1a1a2e",fontWeight:600}}>{item.tel||"—"}</div>
        </div>
        <div style={{background:"#fffbf3",borderRadius:14,padding:"11px 16px",marginBottom:20,
          textAlign:"left",border:"1.5px solid #F4A261"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#c97e1a",marginBottom:4}}>Tu info compartida</div>
          <div style={{fontSize:13,color:"#444"}}>{myEmail}</div>
          <div style={{fontSize:13,color:"#444",marginTop:2}}>{myTel}</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose}
            style={{flex:1,background:"#f0f0f8",color:"#1a1a2e",border:"none",
              borderRadius:99,padding:"13px 0",fontWeight:700,cursor:"pointer",
              fontSize:13,fontFamily:"inherit"}}>
            Seguir explorando
          </button>
          <button onClick={onGoToMatches}
            style={{flex:1,background:"#1a1a2e",color:"#fff",border:"none",
              borderRadius:99,padding:"13px 0",fontWeight:700,cursor:"pointer",
              fontSize:13,fontFamily:"inherit"}}>
            Ver conexiones
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── NUEVA BÚSQUEDA MODAL (profesional) ──────────────────────────────────────

const NuevaBusquedaModal = ({userData,uInit,esEmpresa,verificado,obrasActivas,setMisBusquedas,setObras,onSuscribir,toast_,onClose,busquedaEditar,idxEditar}) => {
  var esEdicion = busquedaEditar!=null;
  var init = busquedaEditar||{};
  const [titulo,  setTitulo]  = useState(init.descripcion||init.titulo||"");
  const [desc,    setDesc]    = useState(init.desc||"");
  const [ciudad,  setCiudad]  = useState(init.ciudad||"");
  const [pres,    setPres]    = useState(init.presupuesto||"");
  const [moneda,  setMoneda]  = useState(init.moneda||"ARS");
  const [seguro,  setSeguro]  = useState(init.seguro!==undefined?init.seguro:null);
  const [tipo,    setTipo]    = useState(init.tipo||"");
  const [urgente, setUrgente] = useState(init.urgente||false);
  var ok = titulo && ciudad;

  const publicar = function(){
    if(esEmpresa){
      var empNombre = userData.empresa||userData.nombre||"Empresa";
      var empInit   = empNombre.split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();
      var limiteAlcanzado = !verificado&&!esEdicion&&(obrasActivas||0)>=3;
      var estadoNuevo = limiteAlcanzado?"pausada":"activa";
      var nuevo = {
        id:esEdicion?busquedaEditar.id:Date.now(),
        empresa:empNombre,tipo:tipo||"Busqueda",ciudad:ciudad,distancia:5,
        presupuesto:Number(pres)||0,moneda:moneda,duracion:"A convenir",urgente:urgente,
        descripcion:desc||titulo,requisitos:[titulo],avatar:empInit,
        color:busquedaEditar?busquedaEditar.color:"#2A9D8F",
        email:userData.email||"",tel:userData.tel||"",seguro:seguro,
        estado:estadoNuevo,pausadoPorLimite:limiteAlcanzado,esMia:true,
      };
      if(esEdicion){
        setObras(function(prev){return prev.map(function(x){return x.id===busquedaEditar.id?nuevo:x;});});
        toast_("Aviso actualizado");
      } else {
        setObras(function(prev){return [...prev,nuevo];});
        toast_(limiteAlcanzado?"Aviso guardado en espera — verificá tu empresa para activarlo":"Aviso publicado");
      }
    } else {
      var nombre = ((userData.nombre||"")+" "+(userData.apellido||"")).trim();
      var nb = {
        id:esEdicion?busquedaEditar.id:Date.now(),
        empresa:nombre||"Profesional",tipo:"Busqueda puntual",ciudad:ciudad,distancia:2,
        presupuesto:Number(pres)||0,moneda:moneda,duracion:"A convenir",urgente:false,
        descripcion:desc||titulo,requisitos:[],avatar:uInit,color:"#2A9D8F",
        email:userData.email||"",tel:userData.tel||"",esProfesional:true,
        seguro:seguro,estado:esEdicion?(busquedaEditar.estado||"activa"):"activa",
      };
      if(esEdicion){
        setMisBusquedas(function(prev){return prev.map(function(x,j){return j===idxEditar?nb:x;});});
        toast_("Busqueda actualizada");
      } else {
        setMisBusquedas(function(prev){return [...prev,nb];});
        toast_("Busqueda publicada");
      }
    }
    onClose();
  };

  const eliminar = function(){
    if(esEmpresa){
      setObras(function(prev){return prev.filter(function(x){return x.id!==busquedaEditar.id;});});
    } else {
      setMisBusquedas(function(prev){return prev.filter(function(_,j){return j!==idxEditar;});});
    }
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,.88)",zIndex:800,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",
        width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto",animation:"slideUp .25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:18,color:"#1a1a2e"}}>
            {esEdicion?(esEmpresa?"Editar aviso":"Editar busqueda"):(esEmpresa?"Nuevo aviso":"Nueva busqueda")}
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"none",fontSize:22,color:"#aaa",cursor:"pointer",fontFamily:"inherit"}}>
            x
          </button>
        </div>
        {esEmpresa?(
          <>
            <Inp label="Puesto buscado *" placeholder="Ej: Tecnico SyH para obra en altura"
              value={titulo} onChange={setTitulo}/>
            <Inp label="Tipo de obra / proyecto" optional placeholder="Ej: Obra civil"
              value={tipo} onChange={setTipo}/>
          </>
        ):(
          <Inp label="Que necesitas? *" placeholder="Ej: Tecnico SyH para obra en altura"
            value={titulo} onChange={setTitulo}/>
        )}
        <Inp label="Ciudad / Zona *" placeholder="Ej: Palermo, CABA" value={ciudad} onChange={setCiudad}/>
        <Txt label="Descripcion" optional value={desc} onChange={setDesc}
          placeholder={esEmpresa?"Describe el proyecto y requisitos...":"Mas detalles..."}/>
        <Honorarios value={pres} moneda={moneda} onValue={setPres} onMoneda={setMoneda}/>
        {esEmpresa&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            background:"#f8f8fc",borderRadius:12,padding:"12px 14px",marginBottom:18}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>Marcar como urgente</div>
              <div style={{fontSize:11,color:"#888"}}>Badge rojo destacado</div>
            </div>
            <button onClick={function(){setUrgente(function(u){return !u;});}}
              style={{width:44,height:26,borderRadius:99,border:"none",
                background:urgente?"#E63946":"#e0e0ef",cursor:"pointer",
                position:"relative",transition:"background .2s",fontFamily:"inherit"}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",
                position:"absolute",top:4,left:urgente?22:4,transition:"left .2s"}}/>
            </button>
          </div>
        )}
        <ToggleSeguro pais={userData.pais} value={seguro} onChange={setSeguro} esOferta={true}/>
        <button onClick={publicar} disabled={!ok}
          style={{width:"100%",padding:14,borderRadius:14,border:"none",
            background:ok?"#1a1a2e":"#ccc",color:"#fff",fontWeight:800,fontSize:15,
            cursor:ok?"pointer":"not-allowed",fontFamily:"inherit",marginBottom:esEdicion?10:0}}>
          {esEdicion?(esEmpresa?"Guardar aviso":"Guardar cambios"):(esEmpresa?"Publicar aviso":"Publicar busqueda")}
        </button>
        {esEdicion&&(
          <button onClick={eliminar}
            style={{width:"100%",padding:13,borderRadius:14,border:"1.5px solid #fdecea",
              background:"#fdecea",color:"#E63946",fontWeight:700,fontSize:14,
              cursor:"pointer",fontFamily:"inherit"}}>
            Eliminar {esEmpresa?"aviso":"busqueda"}
          </button>
        )}
      </div>
    </div>
  );
};


// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const OportunidadesSwipe = ({obras, posts, feedSkips, setPosts, setFeedSkips, setPostViendo, toast_}) => {
  const feedItems = obras.filter(o=>!posts.includes(o.id)&&!feedSkips.includes(o.id));
  const obraActual = feedItems[0] || null;
  const totalVistas = posts.filter(id=>obras.some(o=>o.id===id)).length;
  const [dragX,setDragX] = useState(0);
  const [dragging,setDragging] = useState(false);
  const [startX,setStartX] = useState(0);

  const onStart = cx => { setDragging(true); setStartX(cx-dragX); };
  const onMove  = cx => { if(!dragging) return; setDragX(cx-startX); };
  const onEnd   = () => {
    if(!dragging) return; setDragging(false);
    if(dragX>80 && obraActual){ setPosts(p=>[...p,obraActual.id]); toast_("Postulación enviada a "+obraActual.empresa); setDragX(0); }
    else if(dragX<-80 && obraActual){ setFeedSkips(p=>[...p,obraActual.id]); setDragX(0); }
    else setDragX(0);
  };

  if(!obraActual) return (
    <div style={{textAlign:"center",padding:"60px 20px",color:"#999"}}>
      <div style={{fontSize:48,marginBottom:12}}>🎉</div>
      <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>¡Revisaste todas las oportunidades!</div>
      <div style={{fontSize:13,lineHeight:1.5}}>Volvé más tarde para ver nuevas búsquedas en tu zona.</div>
    </div>
  );

  const sym = obraActual.moneda==="USD"?"U$D":"$";

  return (
    <div>
      <div style={{fontSize:13,color:"#888",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
        <span>{feedItems.length} oportunidades restantes</span>
        {totalVistas>0&&<span style={{color:"#2A9D8F",fontWeight:600}}>{totalVistas} enviadas ✓</span>}
      </div>
      {/* Indicadores direccionales */}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,padding:"0 4px"}}>
        <span style={{fontSize:12,color:dragX<-40?"#E63946":"transparent",fontWeight:700,transition:"color .15s"}}>← Pasar</span>
        <span style={{fontSize:12,color:dragX>40?"#2A9D8F":"transparent",fontWeight:700,transition:"color .15s"}}>Postularme →</span>
      </div>
      {/* Card swipeable */}
      <div
        onMouseDown={e=>onStart(e.clientX)} onMouseMove={e=>onMove(e.clientX)} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={e=>onStart(e.touches[0].clientX)} onTouchMove={e=>onMove(e.touches[0].clientX)} onTouchEnd={onEnd}
        style={{
          position:"relative",
          transform:`rotate(${dragX*0.04}deg) translateX(${dragX}px)`,
          transition:dragging?"none":"transform 0.3s ease",
          cursor:"grab",userSelect:"none",
          background:"#fff",borderRadius:16,
          boxShadow:"0 2px 16px rgba(0,0,0,0.1)",
          overflow:"hidden",
        }}>
        {dragX>40&&<div style={{position:"absolute",top:16,right:16,zIndex:10,background:"#2A9D8F",borderRadius:99,padding:"6px 14px",fontWeight:800,fontSize:13,color:"#fff"}}>POSTULARME ✓</div>}
        {dragX<-40&&<div style={{position:"absolute",top:16,left:16,zIndex:10,background:"#E63946",borderRadius:99,padding:"6px 14px",fontWeight:800,fontSize:13,color:"#fff"}}>PASAR ✕</div>}
        <div style={{height:5,background:obraActual.color||"#2A9D8F"}}/>
        <div style={{padding:18}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:14}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:obraActual.color||"#2A9D8F",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:18,flexShrink:0}}>
              {(obraActual.avatar||(obraActual.empresa||"??").slice(0,2)).toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{fontWeight:800,fontSize:16,color:"#1a1a2e"}}>{obraActual.empresa}</div>
                {obraActual.urgente&&<span style={{background:"#E63946",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,flexShrink:0}}>URGENTE</span>}
              </div>
              <div style={{fontSize:12,color:"#888",marginTop:2}}>{obraActual.tipo} · {obraActual.ciudad}</div>
            </div>
          </div>
          <p style={{fontSize:14,color:"#444",lineHeight:1.6,margin:"0 0 14px"}}>{obraActual.descripcion}</p>
          {obraActual.requisitos?.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
              {obraActual.requisitos.map((r,i)=>(
                <span key={i} style={{background:"#f0f0f8",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#1a1a2e"}}>{r}</span>
              ))}
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid #f0f0f0"}}>
            <div>
              <span style={{fontSize:22,fontWeight:800,color:"#1a1a2e"}}>{sym}{(obraActual.presupuesto||0).toLocaleString()}</span>
              <span style={{fontSize:12,color:"#888",marginLeft:4}}>/h · {obraActual.moneda}</span>
            </div>
            <button onClick={e=>{e.stopPropagation();setPostViendo(obraActual);}}
              style={{background:"#f0f0f8",border:"none",borderRadius:99,padding:"7px 14px",fontSize:12,fontWeight:600,color:"#1a1a2e",cursor:"pointer",fontFamily:"inherit"}}>
              Ver más ↗
            </button>
          </div>
        </div>
      </div>
      {/* Botones sutiles */}
      <div style={{display:"flex",gap:20,marginTop:20,justifyContent:"center"}}>
        <button onClick={()=>setFeedSkips(p=>[...p,obraActual.id])}
          style={{width:56,height:56,borderRadius:"50%",border:"1.5px solid #E63946",
            background:"#fff",color:"#E63946",fontSize:20,cursor:"pointer",
            fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>
          ✕
        </button>
        <button onClick={()=>{setPosts(p=>[...p,obraActual.id]);toast_("Postulación enviada a "+obraActual.empresa);}}
          style={{width:56,height:56,borderRadius:"50%",border:"1.5px solid #2A9D8F",
            background:"#fff",color:"#2A9D8F",fontSize:20,cursor:"pointer",
            fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>
          ✓
        </button>
      </div>
      <div style={{textAlign:"center",color:"#bbb",fontSize:12,marginTop:10}}>Deslizá o usá los botones</div>
    </div>
  );
};

const MainApp = ({userRol,userData:init0,authData,obras:initObras,setObrasRoot,onLogout,esPrimerLogin=false}) => {
  const esEmpresa = userRol==="empresa";
  const [tab,setTab]                   = useState(esEmpresa?"mis_busquedas":"swipe");
  const [vista,setVista]               = useState("profesional");
  const [idx,setIdx]                   = useState(0);
  const [matches,setMatches]           = useState([]);
  const [matchPop,setMatchPop]         = useState(null);
  const [toast,setToast]               = useState(null);
  const [posts,setPosts]               = useState([]);
  const [editando,setEditando]         = useState(false);
  const [userData,setUserData]         = useState(init0);
  const [chatWith,setChatWith]         = useState(null);
  const [perfilViendo,setPerfilViendo] = useState(null);
  const [valorando,setValorando]       = useState(null);
  const [valoraciones,setValoraciones] = useState({});
  const [misBusquedas,setMisBusquedas] = useState([]);
  const [showNueva,setShowNueva]       = useState(false);
  const [postViendo,setPostViendo]     = useState(null);
  const [showTour,setShowTour]         = useState(esPrimerLogin);
  const [dbProfiles,setDbProfiles]     = useState([]);
  const [loadingProfiles,setLoadingProfiles] = useState(false);
  // Profesional no necesita obras de Root — empresa sí
  const [obrasLocales, setObrasLocales] = useState(esEmpresa ? (initObras||[]) : (initObras||[]));
  const obras = obrasLocales;
  const setObras = esEmpresa ? (fn => {
    setObrasLocales(fn);
    if(setObrasRoot) setObrasRoot(fn);
  }) : setObrasLocales;
  const [verificado,setVerificado]     = useState(userData.verificado||false);
  const [showSusc,setShowSusc]         = useState(false);
  const [editBusq,setEditBusq]         = useState(null);
  const [confirmElim,setConfirmElim]   = useState(null);
  const [estadosPost,setEstadosPost]   = useState({});
  const [feedSkips,setFeedSkips]       = useState([]);
  const [filtros,setFiltros]           = useState({sector:"",disponible:false});
  const [showFiltros,setShowFiltros]   = useState(false); // obras pasadas en oportunidades
  const [reportes,setReportes]         = useState([]);
  const [reportando,setReportando]     = useState(null); // match que se está reportando
  const [bloqueados,setBloqueados]     = useState([]); // ids bloqueados

  // obras = todas las obras disponibles (feed para profesionales)
  // Si es empresa: sus propias obras son las que tienen su nombre
  // Cargar perfiles reales de Supabase al montar
  useEffect(()=>{
    const loadProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const profiles = await supa.getProfiles(authData?.token, userRol);
        if(Array.isArray(profiles) && profiles.length > 0) {
          // Mapear perfiles de DB al formato de la app
          const mapped = profiles.map(p => ({
            ...p,
            id: p.id,
            nombre: p.nombre || "Sin nombre",
            apellido: p.apellido || "",
            avatar: p.nombre ? (p.nombre[0]+(p.apellido?p.apellido[0]:"")).toUpperCase() : "??",
            color: "#2A9D8F",
            skills: p.skills || [],
            obras: [],
            perfil: p.perfil || "",
            disponible: p.disponible !== false,
            tarifa: p.tarifa || 0,
            moneda: p.moneda || "ARS",
            rating: null,
            // Calcular distancia real si ambos tienen coords
            distanciaReal: (userData.lat && userData.lng && p.lat && p.lng)
              ? Math.round(haversine(userData.lat, userData.lng, p.lat, p.lng))
              : null,
          }));

          // Filtrar por radio si el usuario tiene coordenadas
          const radioKm = Number(userData.radio) || 9999;
          const filtrados = mapped.filter(p => {
            if(!userData.lat || !userData.lng || !p.lat || !p.lng) return true; // Sin coords, mostrar igual
            return p.distanciaReal <= radioKm;
          });

          setDbProfiles(filtrados);
        }
      } catch(e) { console.log("Error cargando perfiles:", e); }
      setLoadingProfiles(false);
    };
    loadProfiles();
  },[]);

  const empNombre = userData.empresa||userData.nombre||"";
  const misObrasEmpresa = esEmpresa
    ? obras.filter(o=>o.esMia===true)
    : [];
  const setMisObrasEmpresa = (fn) => {
    setObras(prev=>{
      const mias = prev.filter(o=>o.esMia===true);
      const otras = prev.filter(o=>!o.esMia);
      const nuevasMias = typeof fn==="function" ? fn(mias) : fn;
      return [...otras, ...nuevasMias];
    });
  };
  // Filtrar bloqueados del swipe
  // Combinar perfiles reales de DB con demos — reales primero
  const todosLosProfesionales = [
    ...dbProfiles.filter(p=>p.rol==="profesional"),
    ...profesionales.filter(p=>!dbProfiles.find(db=>db.id===p.id))
  ].filter(p=>{
    if(bloqueados.includes(p.id)) return false;
    if(filtros.sector && !p.skills?.some(s=>s.toLowerCase().includes(filtros.sector.toLowerCase()))) return false;
    if(filtros.disponible && !p.disponible) return false;
    return true;
  });

  const todasLasEmpresas = [
    ...dbProfiles.filter(p=>p.rol==="empresa"),
    ...obras,
  ];

  const profesionalesFiltrados = todosLosProfesionales;
  const items = vista==="profesional"?profesionalesFiltrados:todasLasEmpresas;
  const remaining = items.slice(idx);
  const toast_ = (msg,color) => {
    setToast({msg,color:color||"#2A9D8F"});
    setTimeout(()=>setToast(null),2500);
  };
  const swipe = dir => {
    const cur=items[idx];
    if(dir==="yes"){
      if(Math.random()>.4){setMatches(m=>[...m,cur]);setTimeout(()=>setMatchPop(cur),300);}
      else toast_("Interés enviado!");
    }
    setIdx(i=>i+1);
  };

  const sym = userData.moneda==="USD"?"U$D":"$";
  const uInit = userData.nombre
    ? (userData.nombre[0]+((userData.apellido||" ")[0])).toUpperCase()
    : (userData.empresa||"??").slice(0,2).toUpperCase();
  const DC = {disponible:"#2A9D8F",obra:"#F4A261",parcial:"#F4A261",no:"#E63946"};
  const DL = {disponible:"Disponible",obra:"En obra",parcial:"Parcial",no:"No disponible"};

  const TABS_PRO = [
    {id:"swipe",l:"Descubrir",e:"🔍"},
    {id:"feed",l:"Oportunidades",e:"🏗️"},
    {id:"mis_busquedas",l:"Mis búsquedas",e:"📋"},
    {id:"matches",l:"Conexiones",e:"🤝"},
    {id:"perfil",l:"Mi Perfil",e:"👤"},
  ];
  const TABS_EMP = [
    {id:"mis_busquedas",l:"Mis búsquedas",e:"📋"},
    {id:"matches",l:"Conexiones",e:"🤝"},
    {id:"perfil",l:"Mi Perfil",e:"👤"},
  ];
  const TABS = esEmpresa?TABS_EMP:TABS_PRO;

  // Candidatos demo para empresa
  const CANDS = profesionales.slice(0,3).map((p,i)=>({
    ...p, fechaPost:"Hace "+(i+1)+" dia"+( i>0?"s":""), estado:"pendiente"
  }));

  // Panel postulantes empresa
  if(postViendo) return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",
      minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto"}}>
      <style>{CSS}</style>
      {chatWith&&<ChatWindow match={chatWith} userData={userData} onClose={()=>setChatWith(null)}/>}
      {perfilViendo&&(
        <PerfilCompleto persona={perfilViendo} onClose={()=>setPerfilViendo(null)}
          onChat={()=>{setChatWith(perfilViendo);setPerfilViendo(null);}}
          onValorar={userRol==="profesional"?v=>{setValoraciones(p=>({...p,[perfilViendo.id]:v}));setPerfilViendo(null);}:null}
          onReportar={!esEmpresa?()=>setReportando(perfilViendo):null}/>
      )}
      <div style={{background:"#1a1a2e",padding:"14px 20px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={()=>setPostViendo(null)}
          style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,fontFamily:"inherit"}}>
          ‹
        </button>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>{postViendo.empresa}</div>
          <div style={{fontSize:11,color:"#aaa"}}>{postViendo.tipo} · {postViendo.ciudad}</div>
        </div>
        <span style={{background:"#F4A261",color:"#1a1a2e",fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:99}}>
          {CANDS.length} postulantes
        </span>
      </div>
      <div style={{flex:1,padding:"16px",overflowY:"auto"}}>
        <div style={{fontSize:13,color:"#888",marginBottom:16}}>
          Profesionales que se postularon
        </div>
        {CANDS.map((c,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:16,padding:16,marginBottom:12,
            boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <Av init={c.avatar} color={c.color} size={52}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e"}}>{c.nombre}</div>
                <div style={{fontSize:12,color:"#888"}}>{TITULOS[c.titulo]} · {c.ciudad}</div>
                <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{c.fechaPost}</div>
                {/* Rating del profesional */}
                {c.rating&&(
                  <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                    {[1,2,3,4,5].map(n=>(
                      <span key={n} style={{fontSize:13,color:n<=Math.round(c.rating)?"#F4A261":"#e0e0ef"}}>★</span>
                    ))}
                    <span style={{fontSize:12,fontWeight:700,color:"#1a1a2e"}}>{c.rating}</span>
                    {c.trabajos&&<span style={{fontSize:11,color:"#aaa"}}>({c.trabajos} trabajos)</span>}
                  </div>
                )}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#1a1a2e"}}>{c.tarifa.toLocaleString()}/h</div>
                <div style={{fontSize:10,color:"#888"}}>{c.moneda}</div>
              </div>
            </div>
            <p style={{fontSize:13,color:"#555",lineHeight:1.45,margin:"0 0 10px"}}>{c.perfil}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
              {c.skills.map((s,j)=><Chip key={j}>{s}</Chip>)}
            </div>
            {/* Banner descartado con cuenta regresiva */}
            {(estadosPost[c.id]||"pendiente")==="descartado"&&(
              <div style={{background:"#f8f8f8",borderRadius:10,padding:"10px 14px",
                marginBottom:10,border:"1px solid #e0e0e0",
                display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <div>
                  <div style={{fontSize:12,color:"#888",lineHeight:1.4}}>
                    ❌ Descartado · Esta conexión desaparecerá en <strong>3 días</strong>
                  </div>
                </div>
                <button
                  onClick={function(){setEstadosPost(function(p){return {...p,[c.id]:"pendiente"};});}}
                  style={{background:"none",border:"1px solid #ccc",borderRadius:8,
                    padding:"5px 10px",fontSize:11,color:"#666",cursor:"pointer",
                    fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>
                  Reactivar
                </button>
              </div>
            )}
            {/* Selector de estado del postulante */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:"#aaa",fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:.4}}>
                Estado
              </div>
              <SelectorEstado
                estado={estadosPost[c.id]||"pendiente"}
                onChange={function(v){setEstadosPost(function(p){return {...p,[c.id]:v};});}}/>
            </div>
            {/* Botones Ver perfil / Chatear / Valorar (solo pro) / Eliminar */}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setPerfilViendo(c)}
                style={{flex:1,padding:"10px",borderRadius:12,background:"#f0f0f8",color:"#1a1a2e",
                  border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Ver perfil
              </button>
              <button onClick={()=>setChatWith(c)}
                style={{flex:2,padding:"10px",borderRadius:12,background:"#1a1a2e",color:"#fff",
                  border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Chatear
              </button>
              {!esEmpresa&&(
                <button onClick={()=>setPerfilViendo(c)}
                  title="Valorar"
                  style={{padding:"10px 12px",borderRadius:12,background:"#fff3e0",
                    color:"#F4A261",border:"1.5px solid #F4A261",fontSize:15,
                    cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  ★
                </button>
              )}
              <button
                onClick={function(){
                  setEstadosPost(function(p){return {...p,[c.id]:"descartado"};});
                  toast_("Descartado · desaparecerá en 3 días","#888");
                }}
                title="Descartar postulante"
                style={{padding:"10px 12px",borderRadius:12,background:"#fdecea",
                  color:"#E63946",border:"1.5px solid #fca5a5",fontSize:15,
                  cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",
      minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto",position:"relative"}}>
      <style>{CSS}</style>
      {showTour&&<TourContextual rol={userRol} tabActual={tab} setTab={setTab} onFin={()=>{setShowTour(false);try{localStorage.setItem("safy_tour_done","1");}catch(e){}}}/>}
      {editando&&<EditarCuenta userData={userData} userRol={userRol}
        onSave={d=>{setUserData(d);setEditando(false);toast_("Perfil actualizado");}}
        onClose={()=>setEditando(false)}
        onLogout={onLogout}
        verificado={verificado}
        onVerificar={()=>{setEditando(false);setShowSusc(true);}}
        onCancelarVerif={()=>setVerificado(false)}/>}
      {chatWith&&<ChatWindow match={chatWith} userData={userData} onClose={()=>setChatWith(null)}/>}
      {perfilViendo&&(
        <PerfilCompleto persona={perfilViendo} onClose={()=>setPerfilViendo(null)}
          onChat={()=>{setChatWith(perfilViendo);setPerfilViendo(null);}}
          onValorar={userRol==="profesional"?v=>{setValoraciones(p=>({...p,[perfilViendo.id]:v}));setPerfilViendo(null);}:null}
          onReportar={!esEmpresa?()=>setReportando(perfilViendo):null}/>
      )}
      {showNueva&&<NuevaBusquedaModal userData={userData} uInit={uInit}
        setMisBusquedas={setMisBusquedas} toast_={toast_}
        onClose={()=>setShowNueva(false)}/>}
      {valorando&&<ModalValoracion match={valorando}
        onSubmit={v=>{setValoraciones(p=>({...p,[valorando.id]:v}));toast_("Valoración enviada");}}
        onClose={()=>setValorando(null)}/>}
      {reportando&&<ModalReporte
        persona={reportando}
        userData={userData}
        onReportar={r=>setReportes(p=>[...p,r])}
        onBloquear={p=>{setBloqueados(b=>[...b,p.id]);setMatches(m=>m.filter(x=>x.id!==p.id));toast_("Usuario bloqueado");}}
        onClose={()=>setReportando(null)}/>}
      {showSusc&&<ModalSuscripcion
        onClose={function(){setShowSusc(false);}}
        onSuscribir={function(){setVerificado(true);setUserData(function(d){return {...d,verificado:true};});}}
        esEmpresa={esEmpresa}/>}
      {(showNueva||editBusq)&&<NuevaBusquedaModal
        userData={userData} uInit={uInit} esEmpresa={esEmpresa}
        verificado={verificado}
        obrasActivas={misObrasEmpresa.filter(function(o){return o.estado!=="pausada";}).length}
        setObras={esEmpresa?setMisObrasEmpresa:setObras} setMisBusquedas={setMisBusquedas}
        onSuscribir={function(){setShowSusc(true);}}
        toast_={toast_}
        busquedaEditar={editBusq?editBusq.busqueda:null}
        idxEditar={editBusq?editBusq.idx:null}
        onClose={function(){setShowNueva(false);setEditBusq(null);}}/>}
      {matchPop&&<MatchPop item={matchPop} userData={userData}
        onClose={()=>setMatchPop(null)}
        onGoToMatches={()=>{setMatchPop(null);setTab("matches");}}/>}

      {/* HEADER */}
      <div style={{background:"#1a1a2e",color:"#fff",padding:"13px 20px 11px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{flex:1}}/>
        <div style={{fontWeight:800,fontSize:24,letterSpacing:-.5,textAlign:"center"}}>
          S<span style={{color:"#F4A261"}}>afy</span>
        </div>
        <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}>
          {tab==="perfil"?(
            <button onClick={onLogout}
              style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:99,
                padding:"7px 13px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",
                fontFamily:"inherit"}}>
              Salir
            </button>
          ):esEmpresa&&tab==="mis_busquedas"?(
            <button onClick={function(){setShowNueva(true);setEditBusq(null);}}
              style={{background:"#F4A261",border:"none",borderRadius:99,
                padding:"7px 14px",color:"#1a1a2e",fontSize:12,fontWeight:800,
                cursor:"pointer",fontFamily:"inherit"}}>
              + Nuevo aviso
            </button>
          ):(
            <div style={{width:60}}/>
          )}
        </div>
      </div>

      <div style={{flex:1,padding:"16px 0 80px",overflowY:"auto"}}>

        {/* SWIPE */}
        {tab==="swipe"&&!esEmpresa&&(
          <div style={{padding:"0 12px"}}>
            {/* Panel filtros */}
            {showFiltros&&(
              <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:14,
                boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1a1a2e",marginBottom:12}}>Filtrar resultados</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#888",marginBottom:6,textTransform:"uppercase"}}>Skill / Sector</div>
                  <input value={filtros.sector} onChange={e=>setFiltros(f=>({...f,sector:e.target.value}))}
                    placeholder="Ej: Altura, NFPA, Ambiental..."
                    style={{width:"100%",padding:"10px 12px",borderRadius:10,
                      border:"1.5px solid #e0e0ef",fontSize:13,fontFamily:"inherit",
                      boxSizing:"border-box"}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>Solo disponibles ahora</div>
                  <button onClick={()=>setFiltros(f=>({...f,disponible:!f.disponible}))}
                    style={{width:44,height:26,borderRadius:99,border:"none",
                      background:filtros.disponible?"#2A9D8F":"#e0e0ef",cursor:"pointer",
                      position:"relative",fontFamily:"inherit",flexShrink:0}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",
                      position:"absolute",top:4,left:filtros.disponible?22:4,transition:"left .2s"}}/>
                  </button>
                </div>
                <button onClick={()=>{setFiltros({sector:"",disponible:false});setShowFiltros(false);}}
                  style={{fontSize:12,color:"#aaa",background:"none",border:"none",
                    cursor:"pointer",fontFamily:"inherit",padding:0}}>
                  Limpiar filtros
                </button>
              </div>
            )}
            <div style={{fontSize:13,color:"#888",marginBottom:14}}>
              {vista==="profesional"?"Profesionales cerca tuyo":"Empresas buscando"} · {remaining.length} restantes
            </div>
            {remaining.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:10}}>✓</div>
                <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e"}}>Viste todos los perfiles</div>
                <button onClick={()=>setIdx(0)}
                  style={{marginTop:20,background:"#1a1a2e",color:"#fff",border:"none",
                    borderRadius:99,padding:"12px 28px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Recargar
                </button>
              </div>
            ):(
              <>
                <div style={{position:"relative",marginBottom:16}}>
                  {remaining.slice(0,3).map((item,i)=>(
                    <div key={item.id} style={{
                      position:i===0?"relative":"absolute",
                      top:0,width:"100%",zIndex:3-i,
                      transform:i>0?("scale("+(1-i*.03)+") translateY("+(i*10)+"px)"):"none",
                      transformOrigin:"top center",
                      pointerEvents:i===0?"auto":"none",
                    }}>
                      <SwipeCard item={item} type={vista==="profesional"?"profesional":"obra"}
                        onSwipe={swipe} isTop={i===0}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"center",gap:20}}>
                  <button onClick={()=>swipe("no")}
                    style={{width:56,height:56,borderRadius:"50%",border:"1.5px solid #E63946",
                      background:"#fff",color:"#E63946",fontSize:20,cursor:"pointer",
                      fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    ✕
                  </button>
                  <button onClick={()=>swipe("yes")}
                    style={{width:56,height:56,borderRadius:"50%",border:"1.5px solid #2A9D8F",
                      background:"#fff",color:"#2A9D8F",fontSize:20,cursor:"pointer",
                      fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    ✓
                  </button>
                </div>
                <div style={{textAlign:"center",color:"#bbb",fontSize:12,marginTop:12}}>
                  Deslizá o usá los botones
                </div>
              </>
            )}
          </div>
        )}

        {/* OPORTUNIDADES */}
        {tab==="feed"&&!esEmpresa&&(
          <div style={{padding:"0 12px"}}>
            <OportunidadesSwipe
              obras={obras}
              posts={posts}
              feedSkips={feedSkips}
              setPosts={setPosts}
              setFeedSkips={setFeedSkips}
              setPostViendo={setPostViendo}
              toast_={toast_}
            />
          </div>
        )}

        {/* MIS BÚSQUEDAS */}
        {tab==="mis_busquedas"&&(
          <div style={{padding:"0 12px"}}>
            {esEmpresa?(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:13,color:"#888"}}>Tus búsquedas activas</div>
                {!verificado&&(
                  <div style={{fontSize:11,color:misObrasEmpresa.filter(function(o){return o.estado!=="pausada";}).length>=3?"#E63946":"#aaa",fontWeight:misObrasEmpresa.filter(function(o){return o.estado!=="pausada";}).length>=3?700:400}}>
                    {misObrasEmpresa.filter(function(o){return o.estado!=="pausada";}).length}/3 gratuitas
                  </div>
                )}
              </div>
                {misObrasEmpresa.length===0?(
                  <div style={{textAlign:"center",padding:"50px 20px",color:"#999"}}>
                    <div style={{fontSize:48,marginBottom:12}}>📋</div>
                    <div style={{fontWeight:700,fontSize:16}}>Sin búsquedas publicadas</div>
                  </div>
                ):(
                  misObrasEmpresa.map(o=>(
                    <div key={o.id} style={{background:"#fff",borderRadius:16,marginBottom:14,
                      overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
                      <div style={{height:5,background:o.color}}/>
                      <div style={{padding:16}}>
                        <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                          <Av init={o.avatar} color={o.color} size={44}/>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e"}}>{o.empresa}</div>
                            <div style={{color:"#888",fontSize:12}}>{o.tipo} · {o.ciudad}</div>
                          </div>
                          {o.urgente&&<Chip selected color="#E63946">URGENTE</Chip>}
                          <button
                            onClick={function(){setEditBusq({busqueda:o,idx:null});}}
                            title="Editar aviso"
                            style={{background:"#f0f0f8",border:"none",borderRadius:8,
                              padding:"6px 8px",fontSize:15,cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}>
                            ⚙️
                          </button>
                        </div>
                        <p style={{fontSize:13,color:"#444",lineHeight:1.45,margin:"0 0 10px"}}>
                          {o.descripcion.slice(0,100)}...
                        </p>
                        {o.pausadoPorLimite&&(
                          <div style={{background:"#fdecea",borderRadius:10,padding:"10px 12px",
                            marginBottom:10,border:"1px solid #fca5a5"}}>
                            <div style={{fontSize:12,fontWeight:700,color:"#E63946",marginBottom:4}}>
                              Aviso pausado — limite gratuito alcanzado
                            </div>
                            <div style={{fontSize:11,color:"#666",lineHeight:1.4,marginBottom:8}}>
                              Verifica tu empresa para activarlo y publicar sin limites.
                            </div>
                            <button onClick={function(){setShowSusc(true);}}
                              style={{width:"100%",padding:"7px 0",borderRadius:8,border:"none",
                                background:"#1D9BF0",color:"#fff",fontWeight:700,fontSize:12,
                                cursor:"pointer",fontFamily:"inherit"}}>
                              Verificar empresa · U$D 9.99/mes
                            </button>
                          </div>
                        )}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
                          <div style={{fontSize:13,fontWeight:800,color:"#1a1a2e"}}>
                            {o.moneda==="USD"?"U$D":"$"}{o.presupuesto.toLocaleString()}/h
                          </div>
                          <button onClick={()=>setPostViendo(o)}
                            style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:99,
                              padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
                              display:"flex",alignItems:"center",gap:6}}>
                            Ver postulantes
                            <span style={{background:"#F4A261",color:"#1a1a2e",borderRadius:99,
                              fontSize:11,padding:"1px 7px",fontWeight:800}}>
                              {CANDS.length}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            ):(
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontSize:13,color:"#888"}}>
                    {misBusquedas.length} búsqueda{misBusquedas.length!==1?"s":""} publicada{misBusquedas.length!==1?"s":""}
                  </div>
                  <button onClick={()=>setShowNueva(true)}
                    style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:99,
                      padding:"8px 14px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    + Nueva búsqueda
                  </button>
                </div>
                {misBusquedas.length===0?(
                  <div style={{background:"#fff",borderRadius:16,padding:28,textAlign:"center",
                    boxShadow:"0 2px 10px rgba(0,0,0,0.07)",border:"1.5px dashed #e0e0ef"}}>
                    <div style={{fontSize:44,marginBottom:12}}>📋</div>
                    <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:6}}>
                      Publicá tu primera búsqueda
                    </div>
                    <div style={{fontSize:13,color:"#888",lineHeight:1.5,marginBottom:16}}>
                      Necesitás un colega para una obra puntual? Conectate con otros profesionales de SyH y MA.
                    </div>
                    <button onClick={()=>setShowNueva(true)}
                      style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:99,
                        padding:"12px 24px",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                      Crear búsqueda
                    </button>
                  </div>
                ):(
                  misBusquedas.map((b,i)=>(
                    <div key={i} style={{background:"#fff",borderRadius:16,marginBottom:12,
                      overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
                      <div style={{height:4,background:b.estado==="pausada"?"#aaa":b.estado==="cubierta"?"#F4A261":"#2A9D8F"}}/>
                      <div style={{padding:14}}>
                        {/* Header con título, estado y ruedita */}
                        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14,color:"#1a1a2e",marginBottom:2}}>
                              {b.descripcion.slice(0,60)}{b.descripcion.length>60?"...":""}
                            </div>
                            <div style={{fontSize:12,color:"#888"}}>{b.ciudad}</div>
                          </div>
                          <span style={{
                            background:b.estado==="pausada"?"#f0f0f0":b.estado==="cubierta"?"#fff3e0":"#e8f7f5",
                            color:b.estado==="pausada"?"#888":b.estado==="cubierta"?"#c97e1a":"#2A9D8F",
                            fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,flexShrink:0}}>
                            {b.estado==="pausada"?"Pausada":b.estado==="cubierta"?"Cubierta":"Activa"}
                          </span>
                          <button onClick={()=>setEditBusq({busqueda:b,idx:i})}
                            title="Editar"
                            style={{background:"#f0f0f8",border:"none",borderRadius:8,
                              padding:"5px 7px",fontSize:14,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                            ⚙️
                          </button>
                        </div>
                        {b.presupuesto>0&&(
                          <div style={{fontSize:14,fontWeight:800,color:"#1a1a2e",marginBottom:10}}>
                            {b.moneda==="USD"?"U$D":"$"}{Number(b.presupuesto).toLocaleString()}/h
                          </div>
                        )}

                        {/* Botones: Ver postulantes / Chatear / Eliminar */}
                        <div style={{display:"flex",gap:6,borderTop:"1px solid #f0f0f0",paddingTop:10}}>
                          <button
                            onClick={()=>setPostViendo(b)}
                            style={{flex:2,padding:"8px 0",borderRadius:10,border:"none",
                              background:"#1a1a2e",color:"#fff",fontSize:12,fontWeight:700,
                              cursor:"pointer",fontFamily:"inherit",
                              display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                            Ver postulantes
                            <span style={{background:"#F4A261",color:"#1a1a2e",borderRadius:99,
                              fontSize:10,padding:"1px 6px",fontWeight:800}}>
                              {CANDS.length}
                            </span>
                          </button>
                          <button
                            onClick={()=>setMisBusquedas(prev=>prev.filter((_,j)=>j!==i))}
                            style={{padding:"8px 10px",borderRadius:10,border:"1.5px solid #fdecea",
                              background:"#fdecea",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* CONEXIONES */}
        {tab==="matches"&&(()=>{
          // Para empresa: conexiones = postulantes con estado activo (visto, proceso, contratado)
          const ESTADOS_ACTIVOS = ["visto","proceso","contratado"];
          const listaConexiones = esEmpresa
            ? CANDS.filter(c=>ESTADOS_ACTIVOS.includes(estadosPost[c.id]||"pendiente"))
            : matches;

          return listaConexiones.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:"#999"}}>
              <div style={{fontSize:48,marginBottom:12}}>🤝</div>
              <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin conexiones aún</div>
              <div style={{fontSize:13,lineHeight:1.5}}>
                {esEmpresa
                  ? "Cuando revises un perfil, lo marques como Visto o En proceso, aparecerá aquí."
                  : "Deslizá perfiles para conectar"}
              </div>
            </div>
          ):(
            <div style={{padding:"0 12px"}}>
              <div style={{fontSize:13,color:"#888",marginBottom:16}}>
                {listaConexiones.length} conexion{listaConexiones.length!==1?"es":""} activa{listaConexiones.length!==1?"s":""}
              </div>
              {listaConexiones.map((m,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:16,padding:16,marginBottom:12,
                  boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
                    <Av init={m.avatar} color={m.color} size={52} foto={m.foto||""}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:15,color:"#1a1a2e",marginBottom:2,display:"flex",alignItems:"center",gap:5}}>
                        {m.nombre||m.empresa}
                        {m.verificado&&<BadgeVerificado size={13}/>}
                      </div>
                      <div style={{fontSize:12,color:"#666",marginBottom:4}}>
                        {TITULOS[m.titulo]||m.tipo||""}
                      </div>
                      <div style={{fontSize:11,color:"#aaa",marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
                        {m.ciudad||"—"}
                        {m.distancia!=null&&(
                          <span style={{background:"#f0f0f8",color:"#555",padding:"1px 7px",
                            borderRadius:99,fontSize:11,fontWeight:600}}>
                            {m.distancia} km
                          </span>
                        )}
                      </div>
                      {m.rating&&(
                        <RatingStars rating={m.rating} trabajos={m.trabajos} canRate={false}/>
                      )}
                    </div>
                    <span style={{background:"#e8f7f5",color:"#2A9D8F",fontSize:10,fontWeight:700,
                      padding:"3px 9px",borderRadius:99,flexShrink:0}}>
                      ✓
                    </span>
                  </div>
                  <div style={{background:"#f8f8fc",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#aaa",marginBottom:5,textTransform:"uppercase"}}>
                      Contacto
                    </div>
                    <div style={{fontSize:13,color:"#1a73e8",fontWeight:600,marginBottom:3}}>
                      {m.email||"contacto@safy.app"}
                    </div>
                    <div style={{fontSize:13,color:"#1a1a2e",fontWeight:600}}>{m.tel||"—"}</div>
                  </div>
                  {/* Estado postulacion — solo empresa ve/gestiona, profesional solo ve si postulo a empresa */}
                  {esEmpresa&&(
                    <div style={{marginBottom:8}}>
                      <SelectorEstado
                        estado={estadosPost[m.id]||"pendiente"}
                        onChange={function(v){setEstadosPost(function(p){return {...p,[m.id]:v};});}}/>
                    </div>
                  )}
                  {!esEmpresa&&m.esEmpresaMatch&&(
                    <div style={{marginBottom:8}}>
                      <BadgeEstado estado={estadosPost[m.id]||"pendiente"}/>
                    </div>
                  )}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={function(){setPerfilViendo(m);}}
                      style={{flex:1,padding:"10px 0",borderRadius:12,background:"#f0f0f8",
                        color:"#1a1a2e",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      Ver perfil
                    </button>
                    <button onClick={function(){setChatWith(m);}}
                      style={{flex:1,padding:"10px 0",borderRadius:12,background:"#1a1a2e",
                        color:"#fff",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                      Chatear
                    </button>
                    {esEmpresa&&(
                      confirmElim===i?(
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={function(){
                            setEstadosPost(function(p){return {...p,[m.id]:"descartado"};});
                            setMatches(function(prev){return prev.filter(function(_,j){return j!==i;});});
                            setConfirmElim(null);
                          }}
                            style={{padding:"7px 10px",borderRadius:10,border:"none",
                              background:"#E63946",color:"#fff",fontWeight:700,fontSize:11,
                              cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                            Si, eliminar
                          </button>
                          <button onClick={function(){setConfirmElim(null);}}
                            style={{padding:"7px 10px",borderRadius:10,border:"1.5px solid #e0e0ef",
                              background:"#fff",color:"#888",fontWeight:600,fontSize:11,
                              cursor:"pointer",fontFamily:"inherit"}}>
                            No
                          </button>
                        </div>
                      ):(
                        <button onClick={function(){setConfirmElim(i);}}
                          style={{padding:"10px 11px",borderRadius:12,background:"#fdecea",
                            color:"#E63946",border:"1.5px solid #fca5a5",fontSize:15,
                            cursor:"pointer",fontFamily:"inherit"}}>
                          🗑
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* MI PERFIL */}
        {tab==="perfil"&&(
          <div style={{padding:"0 12px"}}>
            <div style={{background:"#fff",borderRadius:16,padding:20,
              boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:14}}>
              <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
                <Av init={uInit} color="#1a1a2e" size={70} foto={userData.foto||""}/>
                <div style={{flex:1}}>
                  {/* Nombre principal */}
                  <div style={{fontWeight:800,fontSize:18,color:"#1a1a2e",
                    display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    {esEmpresa
                      ? (userData.empresa||userData.nombre||"Mi Empresa")
                      : (userData.nombre?(userData.nombre+" "+(userData.apellido||"")).trim():"Profesional")}
                    {verificado&&<BadgeVerificado size={18}/>}
                  </div>
                  {/* Para empresa: contacto debajo del nombre */}
                  {esEmpresa&&userData.contacto&&(
                    <div style={{fontSize:13,color:"#666",marginTop:2,fontWeight:500}}>
                      Contacto: {userData.contacto}
                    </div>
                  )}
                  <div style={{color:"#666",fontSize:14,marginTop:esEmpresa&&userData.contacto?2:0}}>
                    {esEmpresa?userData.rubro||"Empresa":TITULOS[userData.titulo]||"Profesional"}
                  </div>
                  <div style={{fontSize:13,color:"#888",marginTop:2}}>
                    {[userData.ciudad,userData.provincia].filter(Boolean).join(", ")||"Sin ubicación"}
                  </div>
                  {!esEmpresa&&userData.disponibilidad&&(
                    <div style={{marginTop:6}}>
                      <span style={{
                        background:(DC[userData.disponibilidad]||"#999")+"22",
                        color:DC[userData.disponibilidad]||"#999",
                        padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:700}}>
                        {DL[userData.disponibilidad]||""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {(userData.descripcion||userData.descripcionObra)&&(
                <div style={{background:"#f8f8fc",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
                  <p style={{fontSize:13,color:"#444",lineHeight:1.55,margin:0}}>
                    {userData.descripcion||userData.descripcionObra}
                  </p>
                </div>
              )}
              {(userData.skills||[]).length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#999",marginBottom:8,textTransform:"uppercase"}}>
                    Skills
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {userData.skills.map((s,i)=><Chip key={i}>{s}</Chip>)}
                  </div>
                </div>
              )}
              <div style={{borderTop:"1px solid #f0f0f0",paddingTop:14,
                display:"flex",justifyContent:"space-between"}}>
                {!esEmpresa&&(
                  <div>
                    <div style={{fontSize:11,color:"#999",fontWeight:600}}>TARIFA / HORA</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#1a1a2e"}}>
                      {userData.tarifa||userData.presupuesto
                        ?(sym+Number(userData.tarifa||userData.presupuesto).toLocaleString()+"/h")
                        :"No indicado"}
                    </div>
                  </div>
                )}
                <div style={{textAlign:esEmpresa?"left":"right"}}>
                  <div style={{fontSize:11,color:"#999",fontWeight:600}}>
                    {esEmpresa?"BÚSQUEDAS ACTIVAS":"CONEXIONES"}
                  </div>
                  <div style={{fontSize:22,fontWeight:800,color:"#1a1a2e"}}>
                    {esEmpresa
                      ? misObrasEmpresa.filter(function(o){return o.estado!=="pausada";}).length
                      : matches.length}
                  </div>
                </div>
              </div>
            </div>
            {(userData.email||userData.tel)&&(
              <div style={{background:"#fff",borderRadius:16,padding:18,
                boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:10}}>Contacto</div>
                {userData.email&&<div style={{fontSize:13,color:"#1a73e8",marginBottom:6,fontWeight:600}}>{userData.email}</div>}
                {userData.tel&&<div style={{fontSize:13,color:"#1a1a2e",fontWeight:600}}>{userData.tel}</div>}
              </div>
            )}
            {(userData.obras||[]).length>0&&(
              <div style={{background:"#fff",borderRadius:16,padding:20,
                boxShadow:"0 2px 12px rgba(0,0,0,0.08)",marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Obras</div>
                {userData.obras.map((o,i)=>(
                  <div key={i} style={{padding:"8px 0",
                    borderBottom:i<userData.obras.length-1?"1px solid #f0f0f0":"none",
                    fontSize:13,color:"#444"}}>
                    {o}
                  </div>
                ))}
              </div>
            )}
            {/* Compartir perfil */}
            <div style={{background:"#fff",borderRadius:16,padding:16,
              boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:12}}>Compartir mi perfil</div>
              <div style={{display:"flex",gap:8}}>
                <button
                  onClick={()=>{
                    const name = (userData.nombre||userData.empresa||"").replace(/\s/g,"-").toLowerCase();
                    const link = "https://safy.app/perfil/"+name;
                    if(navigator.clipboard) navigator.clipboard.writeText(link).then(()=>toast_("Link copiado"));
                  }}
                  style={{flex:1,padding:"10px 0",borderRadius:12,border:"1.5px solid #e0e0ef",
                    background:"#fff",fontSize:12,fontWeight:700,color:"#1a1a2e",cursor:"pointer",
                    fontFamily:"inherit"}}>
                  🔗 Copiar link
                </button>
                <button
                  onClick={()=>{
                    const name = (userData.nombre||userData.empresa||"").replace(/\s/g,"-").toLowerCase();
                    const link = "https://safy.app/perfil/"+name;
                    const texto = encodeURIComponent("Mi perfil profesional en Safy: "+link);
                    window.open("https://wa.me/?text="+texto,"_blank");
                  }}
                  style={{flex:1,padding:"10px 0",borderRadius:12,border:"none",background:"#25D366",
                    fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                  WhatsApp
                </button>
                <button
                  onClick={()=>{
                    const name = (userData.nombre||userData.empresa||"").replace(/\s/g,"-").toLowerCase();
                    const link = encodeURIComponent("https://safy.app/perfil/"+name);
                    window.open("https://www.linkedin.com/sharing/share-offsite/?url="+link,"_blank");
                  }}
                  style={{padding:"10px 14px",borderRadius:12,border:"none",background:"#0A66C2",
                    fontSize:12,fontWeight:800,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                  in
                </button>
              </div>
            </div>
            {!verificado&&(
              <button onClick={function(){setShowSusc(true);}}
                style={{width:"100%",padding:14,borderRadius:14,border:"1.5px solid #1D9BF0",
                  background:"#fff",color:"#1D9BF0",fontWeight:700,fontSize:14,
                  cursor:"pointer",fontFamily:"inherit",marginBottom:10,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <BadgeVerificado size={16}/>
                {esEmpresa?"Verificá tu empresa":"Verificá tu cuenta"}
              </button>
            )}
            <button onClick={function(){setEditando(true);}}
              style={{width:"100%",padding:15,borderRadius:14,border:"1.5px solid #1a1a2e",
                background:"#fff",color:"#1a1a2e",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
              Editar perfil
            </button>
          </div>
        )}
      </div>

      {/* NAV */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:420,background:"#fff",borderTop:"1px solid #ebebeb",
        display:"flex",padding:"10px 0 14px",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,background:"none",border:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              position:"relative",color:tab===t.id?"#1a1a2e":"#bbb",
              fontWeight:tab===t.id?700:500,fontFamily:"inherit"}}>
            <span style={{fontSize:20}}>{t.e}</span>
            <span style={{fontSize:9}}>{t.l}</span>
            {t.id==="matches"&&matches.length>0&&(
              <span style={{position:"absolute",top:0,right:"18%",background:"#E63946",
                color:"#fff",fontSize:9,fontWeight:800,borderRadius:99,padding:"1px 5px"}}>
                {matches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {toast&&(
        <div style={{position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",
          background:toast.color,color:"#fff",padding:"10px 20px",borderRadius:99,fontSize:13,
          fontWeight:700,boxShadow:"0 4px 16px rgba(0,0,0,.2)",zIndex:500,
          animation:"fadeUp .2s ease",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};


// ─── MODAL REPORTE / BLOQUEO ──────────────────────────────────────────────────
const MOTIVOS_REPORTE = [
  "Perfil falso o engañoso",
  "Conducta inapropiada",
  "Spam o publicidad no solicitada",
  "Información de contacto incorrecta",
  "Acoso o hostigamiento",
  "Otro",
];

const RESEND_KEY = "re_QXyqybgJ_s6pw8gPxbxkoiGmd4em1d7a7";
const REPORT_EMAIL = "derosegustavo27@gmail.com";

const sendReporte = async ({persona, motivo, detalle, reportadoPor}) => {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_KEY,
      },
      body: JSON.stringify({
        from: "Safy Reportes <onboarding@resend.dev>",
        to: [REPORT_EMAIL],
        subject: "🚨 Nuevo reporte en Safy — " + motivo,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#E63946;margin-bottom:4px">🚨 Nuevo reporte en Safy</h2>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#888;font-size:13px;width:140px">Reportado</td>
                  <td style="padding:8px 0;font-weight:700;font-size:14px">${persona.nombre||persona.empresa||"Desconocido"}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px">Email reportado</td>
                  <td style="padding:8px 0;font-size:14px">${persona.email||"—"}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px">Motivo</td>
                  <td style="padding:8px 0;font-weight:700;color:#E63946;font-size:14px">${motivo}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px">Detalle</td>
                  <td style="padding:8px 0;font-size:14px">${detalle||"Sin detalle adicional"}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px">Reportado por</td>
                  <td style="padding:8px 0;font-size:14px">${reportadoPor||"Anónimo"}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px">Fecha</td>
                  <td style="padding:8px 0;font-size:14px">${new Date().toLocaleString("es-AR")}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#aaa;font-size:11px">Safy — Sistema de reportes automáticos</p>
          </div>
        `,
      }),
    });
  } catch(e) {
    console.error("Error enviando reporte:", e);
  }
};

const ModalReporte = ({persona, onReportar, onBloquear, onClose, userData}) => {
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [paso, setPaso] = useState("menu"); // menu | reporte | confirmado

  if(paso==="confirmado") return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,0.92)",zIndex:4000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:28,maxWidth:320,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>✅</div>
        <div style={{fontWeight:800,fontSize:18,color:"#1a1a2e",marginBottom:8}}>Reporte enviado</div>
        <div style={{fontSize:13,color:"#888",lineHeight:1.5,marginBottom:20}}>
          Nuestro equipo revisará el caso. Gracias por ayudarnos a mantener Safy seguro.
        </div>
        <button onClick={onClose}
          style={{width:"100%",padding:13,borderRadius:12,border:"none",
            background:"#1a1a2e",color:"#fff",fontWeight:700,fontSize:14,
            cursor:"pointer",fontFamily:"inherit"}}>
          Cerrar
        </button>
      </div>
    </div>
  );

  if(paso==="reporte") return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,0.92)",zIndex:4000,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",
        width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e",marginBottom:4}}>
          Reportar a {persona.nombre||persona.empresa}
        </div>
        <div style={{fontSize:13,color:"#888",marginBottom:16}}>Seleccioná el motivo</div>
        {MOTIVOS_REPORTE.map(m=>(
          <button key={m} onClick={()=>setMotivo(m)}
            style={{width:"100%",padding:"11px 14px",borderRadius:10,marginBottom:8,
              border:motivo===m?"2px solid #E63946":"1.5px solid #e0e0ef",
              background:motivo===m?"#fdecea":"#fff",
              color:motivo===m?"#E63946":"#444",
              fontWeight:motivo===m?700:400,fontSize:13,
              cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            {m}
          </button>
        ))}
        {motivo&&(
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:700,color:"#888",display:"block",marginBottom:6}}>
              Detalle adicional (opcional)
            </label>
            <textarea value={detalle} onChange={e=>setDetalle(e.target.value)}
              placeholder="Contanos más sobre lo que pasó..."
              style={{width:"100%",height:80,borderRadius:10,border:"1.5px solid #e0e0ef",
                padding:"10px 12px",fontSize:13,fontFamily:"inherit",resize:"none",
                boxSizing:"border-box"}}/>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setPaso("menu")}
            style={{flex:1,padding:12,borderRadius:12,border:"1.5px solid #e0e0ef",
              background:"#fff",color:"#666",fontWeight:700,fontSize:13,
              cursor:"pointer",fontFamily:"inherit"}}>
            Cancelar
          </button>
          <button onClick={()=>{
              onReportar({persona,motivo,detalle,fecha:new Date().toISOString()});
              sendReporte({persona, motivo, detalle, reportadoPor: userData?.email||"Anónimo"});
              setPaso("confirmado");
            }}
            disabled={!motivo}
            style={{flex:2,padding:12,borderRadius:12,border:"none",
              background:motivo?"#E63946":"#ccc",color:"#fff",fontWeight:700,fontSize:13,
              cursor:motivo?"pointer":"not-allowed",fontFamily:"inherit"}}>
            Enviar reporte
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,0.92)",zIndex:4000,
      display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px 20px 36px",
        width:"100%",maxWidth:420}}>
        <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e",marginBottom:4}}>
          {persona.nombre||persona.empresa}
        </div>
        <div style={{fontSize:13,color:"#888",marginBottom:20}}>¿Qué querés hacer?</div>
        <button onClick={()=>setPaso("reporte")}
          style={{width:"100%",padding:14,borderRadius:12,border:"1.5px solid #fdecea",
            background:"#fdecea",color:"#E63946",fontWeight:700,fontSize:14,
            cursor:"pointer",fontFamily:"inherit",marginBottom:10,textAlign:"left",
            display:"flex",alignItems:"center",gap:10}}>
          🚩 Reportar a este usuario
        </button>
        <button onClick={()=>{onBloquear(persona);onClose();}}
          style={{width:"100%",padding:14,borderRadius:12,border:"1.5px solid #e0e0ef",
            background:"#f8f8fc",color:"#555",fontWeight:700,fontSize:14,
            cursor:"pointer",fontFamily:"inherit",marginBottom:20,textAlign:"left",
            display:"flex",alignItems:"center",gap:10}}>
          🚫 Bloquear usuario
        </button>
        <button onClick={onClose}
          style={{width:"100%",padding:12,borderRadius:12,border:"none",
            background:"transparent",color:"#aaa",fontSize:13,
            cursor:"pointer",fontFamily:"inherit"}}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────

const COLORES_ADMIN = ["#E63946","#2A9D8F","#7B2D8B","#F4A261","#264653","#1a1a2e"];

const AdminPanel = ({obras,onAddObra,onDeleteObra,onClose,reportes=[]}) => {
  const [vista,setVista] = useState("lista");
  const [form,setForm] = useState({
    empresa:"",tipo:"",ciudad:"",distancia:"",presupuesto:"",moneda:"ARS",
    duracion:"",urgente:false,descripcion:"",requisitos:"",email:"",tel:"",color:"#E63946"
  });
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const adminObras = obras.filter(o=>o.esAdmin);
  const crear = () => {
    if(!form.empresa||!form.ciudad||!form.descripcion) return;
    const init = form.empresa.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const nuevo = {
      id:Date.now(),empresa:form.empresa,tipo:form.tipo||"Búsqueda",
      ciudad:form.ciudad,distancia:Number(form.distancia)||5,
      presupuesto:Number(form.presupuesto)||0,moneda:form.moneda,
      duracion:form.duracion||"A convenir",urgente:form.urgente,
      descripcion:form.descripcion,
      requisitos:form.requisitos.split(",").map(r=>r.trim()).filter(Boolean),
      avatar:init,color:form.color,email:form.email,tel:form.tel,esAdmin:true,
    };
    onAddObra(nuevo);
    setForm({empresa:"",tipo:"",ciudad:"",distancia:"",presupuesto:"",moneda:"ARS",
      duracion:"",urgente:false,descripcion:"",requisitos:"",email:"",tel:"",color:"#E63946"});
    setVista("lista");
  };
  return (
    <div style={{position:"fixed",inset:0,background:"#0f0f1e",zIndex:900,
      display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto",overflowY:"auto"}}>
      <div style={{background:"#1a1a2e",padding:"16px 20px",display:"flex",alignItems:"center",gap:12,
        position:"sticky",top:0,zIndex:10,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <button onClick={onClose}
          style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,fontFamily:"inherit"}}>
          ‹
        </button>
        <div style={{flex:1,fontWeight:800,fontSize:17,color:"#fff"}}>
          Panel Admin
          <span style={{background:"#F4A261",color:"#1a1a2e",fontSize:10,fontWeight:800,
            padding:"2px 8px",borderRadius:99,marginLeft:8}}>
            SAFY
          </span>
        </div>
        <button onClick={()=>setVista(vista==="lista"?"nueva":"lista")}
          style={{background:vista==="nueva"?"rgba(255,255,255,0.1)":"#F4A261",
            border:"none",borderRadius:99,padding:"7px 14px",fontWeight:700,fontSize:12,
            color:vista==="nueva"?"#aaa":"#1a1a2e",cursor:"pointer",fontFamily:"inherit"}}>
          {vista==="nueva"?"Volver":"+ Nuevo aviso"}
        </button>
      </div>
      <div style={{flex:1,padding:"20px",overflowY:"auto"}}>
        {vista==="lista"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              {[{l:"Avisos activos",v:adminObras.length,c:"#F4A261"},
                {l:"Urgentes",v:adminObras.filter(o=>o.urgente).length,c:"#E63946"},
                {l:"Reportes",v:reportes.length,c:"#9b59b6"},
                {l:"Total app",v:obras.length,c:"#2A9D8F"}].map(({l,v,c})=>(
                <div key={l} style={{flex:1,background:"#1a1a2e",borderRadius:14,padding:"12px 10px",
                  textAlign:"center",border:"1.5px solid "+c+"22"}}>
                  <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:"#888",marginTop:2,lineHeight:1.3}}>{l}</div>
                </div>
              ))}
            </div>
            {adminObras.length===0?(
              <div style={{background:"#1a1a2e",borderRadius:16,padding:24,textAlign:"center",
                border:"1.5px dashed rgba(255,255,255,0.1)"}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:6}}>Sin avisos todavía</div>
                <div style={{fontSize:13,color:"#888",lineHeight:1.5}}>
                  Creá el primer aviso para que los profesionales tengan contenido.
                </div>
              </div>
            ):(
              adminObras.map(o=>(
                <div key={o.id} style={{background:"#1a1a2e",borderRadius:16,marginBottom:12,
                  overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)"}}>
                  <div style={{height:4,background:o.color}}/>
                  <div style={{padding:16}}>
                    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                      <div style={{width:40,height:40,borderRadius:"50%",background:o.color,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:"#fff",fontWeight:700,fontSize:14,flexShrink:0}}>
                        {o.avatar}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>{o.empresa}</div>
                        <div style={{color:"#888",fontSize:12}}>{o.tipo} · {o.ciudad}</div>
                      </div>
                      {o.urgente&&(
                        <span style={{background:"#E63946",color:"#fff",fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:99}}>
                          URGENTE
                        </span>
                      )}
                    </div>
                    <p style={{fontSize:12,color:"#aaa",lineHeight:1.4,margin:"0 0 10px"}}>
                      {o.descripcion.slice(0,100)}...
                    </p>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>
                        {o.moneda==="USD"?"U$D":"$"}{o.presupuesto.toLocaleString()}/h
                      </div>
                      <button onClick={()=>onDeleteObra(o.id)}
                        style={{background:"rgba(230,57,70,0.2)",border:"1px solid rgba(230,57,70,0.4)",
                          borderRadius:99,padding:"5px 12px",color:"#E63946",fontSize:12,
                          fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {vista==="nueva"&&(
          <div>
            <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:4}}>Nuevo aviso</div>
            <div style={{fontSize:13,color:"#888",marginBottom:20}}>Aparecerá en el feed y el swipe</div>
            {[{l:"Empresa *",k:"empresa",ph:"Ej: Constructora Omega S.A."},
              {l:"Tipo de obra",k:"tipo",ph:"Ej: Obra civil"},
              {l:"Ciudad *",k:"ciudad",ph:"Ej: Buenos Aires"},
              {l:"Presupuesto /h",k:"presupuesto",ph:"Ej: 3000"},
              {l:"Duración",k:"duracion",ph:"Ej: 3 meses"},
              {l:"Distancia (km)",k:"distancia",ph:"Ej: 5"},
              {l:"Email",k:"email",ph:"contacto@empresa.com"},
              {l:"Teléfono",k:"tel",ph:"+54 11..."},
            ].map(({l,k,ph})=>(
              <div key={k} style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:"#ccc",marginBottom:6}}>{l}</label>
                <input value={form[k]} onChange={e=>upd(k,e.target.value)} placeholder={ph}
                  style={{width:"100%",padding:"12px 14px",borderRadius:12,
                    border:"1.5px solid rgba(255,255,255,0.2)",fontSize:14,color:"#fff",
                    outline:"none",background:"#0f0f1e",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:"#ccc",marginBottom:6}}>
                Descripción *
              </label>
              <textarea rows={4} value={form.descripcion} onChange={e=>upd("descripcion",e.target.value)}
                placeholder="Descripción detallada del aviso..."
                style={{width:"100%",padding:"12px 14px",borderRadius:12,
                  border:"1.5px solid rgba(255,255,255,0.2)",fontSize:14,color:"#fff",
                  outline:"none",background:"#0f0f1e",resize:"vertical",
                  boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:"#ccc",marginBottom:6}}>
                Requisitos (separados por coma)
              </label>
              <input value={form.requisitos} onChange={e=>upd("requisitos",e.target.value)}
                placeholder="Ej: Licenciado, Exp. en altura"
                style={{width:"100%",padding:"12px 14px",borderRadius:12,
                  border:"1.5px solid rgba(255,255,255,0.2)",fontSize:14,color:"#fff",
                  outline:"none",background:"#0f0f1e",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:"#ccc",marginBottom:8}}>
                Moneda
              </label>
              <div style={{display:"flex",gap:8}}>
                {["ARS","USD"].map(m=>(
                  <button key={m} onClick={()=>upd("moneda",m)}
                    style={{flex:1,padding:"10px",borderRadius:12,fontWeight:700,fontSize:13,
                      border:form.moneda===m?"1.5px solid #F4A261":"1.5px solid rgba(255,255,255,0.2)",
                      background:form.moneda===m?"#F4A261":"#0f0f1e",
                      color:form.moneda===m?"#1a1a2e":"#aaa",cursor:"pointer",fontFamily:"inherit"}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:"#ccc",marginBottom:8}}>
                Color del aviso
              </label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {COLORES_ADMIN.map(c=>(
                  <button key={c} onClick={()=>upd("color",c)}
                    style={{width:36,height:36,borderRadius:"50%",background:c,
                      border:form.color===c?"3px solid #fff":"3px solid transparent",
                      cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}>
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              background:"#1a1a2e",borderRadius:12,padding:"14px 16px",marginBottom:24}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>Marcar como urgente</div>
                <div style={{fontSize:12,color:"#888"}}>Badge rojo destacado</div>
              </div>
              <button onClick={()=>upd("urgente",!form.urgente)}
                style={{width:48,height:28,borderRadius:99,border:"none",
                  background:form.urgente?"#E63946":"rgba(255,255,255,0.2)",
                  cursor:"pointer",position:"relative",transition:"background .2s",
                  flexShrink:0,fontFamily:"inherit"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",
                  position:"absolute",top:4,left:form.urgente?24:4,transition:"left .2s"}}/>
              </button>
            </div>
            <button onClick={crear}
              disabled={!form.empresa||!form.ciudad||!form.descripcion}
              style={{width:"100%",padding:15,borderRadius:14,border:"none",
                background:(!form.empresa||!form.ciudad||!form.descripcion)?"#333":"#F4A261",
                color:(!form.empresa||!form.ciudad||!form.descripcion)?"#666":"#1a1a2e",
                fontWeight:800,fontSize:15,cursor:(!form.empresa||!form.ciudad||!form.descripcion)?"not-allowed":"pointer",
                fontFamily:"inherit"}}>
              Publicar aviso
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function Safy() {
  const [phase,setPhase] = useState("splash");
  const [authData,setAuthData] = useState(null);
  const [userRol,setUserRol] = useState(null);
  const [userData,setUserData] = useState({});
  const [obras,setObras] = useState(OBRAS_SEED);
  const [adminOpen,setAdminOpen] = useState(false);
  const [adminInput,setAdminInput] = useState("");
  const [adminErr,setAdminErr] = useState(false);
  const [primerLogin,setPrimerLogin] = useState(false);

  const tryAdmin = () => {
    if(adminInput===ADMIN_CODE){ setAdminOpen(true); setAdminInput(""); setAdminErr(false); }
    else{ setAdminErr(true); setTimeout(()=>setAdminErr(false),2000); }
  };

  // Detectar retorno de Google OAuth o sesión guardada
  useEffect(()=>{
    const checkOAuth = async () => {
      const hash = window.location.hash;
      const hasToken = hash && hash.includes("access_token");
      if(!hasToken) {
        // Verificar si hay sesión guardada en localStorage
        try {
          const stored = localStorage.getItem("safy_session");
          if(stored) {
            const session = JSON.parse(stored);
            if(session.token && session.user) {
              setAuthData(session);
              setPhase("loading");
              try {
                const profile = await supa.getProfile(session.token, session.user.id);
                if(profile && profile.rol) {
                  setUserRol(profile.rol);
                  setUserData(profile);
                  setPhase("app");
                } else {
                  // Sesión guardada pero sin perfil — cuenta eliminada o incompleta
                  // Limpiar todo y mandar al welcome (no al onboarding, porque no tenemos authData válido)
                  supa.clearSession();
                  setAuthData(null);
                  setPhase("welcome");
                }
              } catch(e) {
                supa.clearSession();
                setAuthData(null);
                setPhase("welcome");
              }
            }
          }
        } catch(e) {
          supa.clearSession();
        }
        return;
      }

      // Procesar retorno de Google OAuth
      const session = await supa.getSessionFromURL();
      if(!session) return;

      supa.saveSession(session);
      setAuthData(session);
      setPhase("loading");

      try {
        const profile = await supa.getProfile(session.token, session.user.id);
        if(profile && profile.rol) {
          // Usuario existente — cargar perfil y ir a la app
          setUserRol(profile.rol);
          setUserData(profile);
          setPhase("app");
        } else {
          // Usuario nuevo — ir al onboarding
          supa.clearSession(); // Limpiar hasta que complete el onboarding
          setPhase("onboarding");
        }
      } catch(e) {
        supa.clearSession();
        setPhase("onboarding");
      }
    };
    checkOAuth();
  },[]);

  if(phase==="loading") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#1a1a2e",minHeight:"100vh",maxWidth:420,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{CSS}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontWeight:800,fontSize:48,color:"#fff",letterSpacing:-2,marginBottom:16}}>S<span style={{color:"#F4A261"}}>afy</span></div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#F4A261",animation:"dotPulse 1.2s ease "+(i*0.2)+"s infinite"}}/>)}
        </div>
      </div>
    </div>
  );

  if(phase==="splash"||phase==="welcome_in") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#1a1a2e",
      minHeight:"100vh",maxWidth:420,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <WelcomeScreen onEntrar={()=>setPhase("login")} onRegistrarse={()=>setPhase("registro")}
        visible={phase==="welcome_in"}/>
      {phase==="splash"&&(
        <SplashScreen onDone={()=>setPhase("welcome_in")}/>
      )}
    </div>
  );

  if(phase==="welcome") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#1a1a2e",
      minHeight:"100vh",maxWidth:420,margin:"0 auto",overflow:"hidden"}}>
      <style>{CSS}</style>
      {adminOpen&&<AdminPanel obras={obras} reportes={[]}
        onAddObra={o=>setObras(p=>[...p,o])}
        onDeleteObra={id=>setObras(p=>p.filter(o=>o.id!==id))}
        onClose={()=>setAdminOpen(false)}/>}
      <WelcomeScreen onEntrar={()=>setPhase("login")} onRegistrarse={()=>setPhase("registro")} visible={true}/>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:420,padding:"8px 24px 16px",textAlign:"center"}}>
        <details style={{display:"inline-block"}}>
          <summary style={{fontSize:10,color:"rgba(85,102,119,0.4)",cursor:"pointer",listStyle:"none",userSelect:"none"}}>· · ·</summary>
          <div style={{marginTop:8,display:"flex",gap:8,justifyContent:"center",alignItems:"center"}}>
            <input value={adminInput} onChange={e=>setAdminInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&tryAdmin()} type="password" placeholder="Código admin"
              style={{padding:"7px 12px",borderRadius:10,border:adminErr?"1.5px solid #E63946":"1.5px solid rgba(85,102,119,0.3)",fontSize:12,outline:"none",width:130,background:"rgba(26,26,46,0.3)",color:"#fff"}}/>
            <button onClick={tryAdmin}
              style={{padding:"7px 12px",borderRadius:10,background:"#F4A261",color:"#1a1a2e",border:"none",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>OK</button>
          </div>
          {adminErr&&<div style={{fontSize:11,color:"#E63946",marginTop:4}}>Código incorrecto</div>}
        </details>
      </div>
    </div>
  );

  // Función central de login — busca perfil en Supabase antes de decidir
  const handleLogin = async (auth) => {
    setAuthData(auth);
    setPhase("loading");
    try {
      const profile = await supa.getProfile(auth.token, auth.user.id);
      if(profile && profile.rol) {
        // Usuario existente — ir directo a la app
        supa.saveSession(auth);
        setUserRol(profile.rol);
        setUserData({...profile, email: auth.email || profile.email});
        setPhase("app");
      } else {
        // Usuario nuevo — completar onboarding
        setPhase("onboarding");
      }
    } catch(e) {
      setPhase("onboarding");
    }
  };

  if(phase==="login") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",
      minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto"}}>
      <style>{CSS}</style>
      <div style={{padding:"16px 20px 0",background:"#fff",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setPhase("welcome")} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",padding:0,fontFamily:"inherit"}}>‹</button>
        <span style={{fontWeight:800,fontSize:18,color:"#1a1a2e",letterSpacing:-.5}}>S<span style={{color:"#F4A261"}}>afy</span></span>
      </div>
      <LoginScreen onLogin={handleLogin} isRegistro={false}/>
    </div>
  );

  if(phase==="registro") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",
      minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto"}}>
      <style>{CSS}</style>
      <div style={{padding:"16px 20px 0",background:"#fff",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setPhase("welcome")} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",padding:0,fontFamily:"inherit"}}>‹</button>
        <span style={{fontWeight:800,fontSize:18,color:"#1a1a2e",letterSpacing:-.5}}>S<span style={{color:"#F4A261"}}>afy</span></span>
      </div>
      <LoginScreen onLogin={handleLogin} isRegistro={true}/>
    </div>
  );

  if(phase==="onboarding") return (
    <Onboarding googleData={authData ? {
      nombre: authData.user?.user_metadata?.full_name?.split(" ")[0] || authData.user?.user_metadata?.name?.split(" ")[0] || "",
      apellido: authData.user?.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
      email: authData.email || "",
      foto: authData.user?.user_metadata?.avatar_url || "",
    } : null} onComplete={async (rol,data)=>{
      setUserRol(rol);
      setPrimerLogin(true);
      setUserData({...data, email: authData?.email||data.email});
      // Guardar sesión recién ahora que completó el onboarding
      if(authData) supa.saveSession(authData);
      if(rol==="empresa") {
        const empNombre = data.empresa || data.contacto || "Mi Empresa";
        const empInit = empNombre.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
        const primerAviso = {
          id: Date.now(), empresa: empNombre,
          tipo: data.sectorObra || data.rubro || "Búsqueda de profesional",
          ciudad: data.zonaObra || data.ciudad || "",
          distancia: Number(data.radio) || 10,
          presupuesto: Number(data.presupuesto) || 0,
          moneda: data.moneda || "ARS", duracion: "A convenir",
          urgente: data.urgencia === "ya",
          descripcion: data.descripcionObra || ("Buscamos profesional en " + (data.sectorObra || data.rubro || "SyH")),
          requisitos: data.skillsReq || [], avatar: empInit,
          color: "#2A9D8F", email: data.email || "", tel: data.tel || "",
          estado: "activa", esMia: true,
        };
        setObras(prev=>[...prev, primerAviso]);
        if(authData?.token) {
          supa.createJob(authData.token, {...primerAviso, empresa_id: authData.user?.id}).catch(()=>{});
        }
      }
      // Guardar sesión
      if(authData) supa.saveSession(authData);

      // Guardar perfil en Supabase — esperar resultado
      console.log("onComplete — authData:", authData ? {token: authData.token?.slice(0,30), userId: authData.user?.id, email: authData.email} : "NULL");
      if(authData?.token && authData?.user?.id) {
        const profileData = {
          id: authData.user.id, rol,
          email: authData.email || data.email,
          nombre: data.nombre || null,
          apellido: data.apellido || null,
          empresa: data.empresa || null,
          tel: data.tel || null,
          pais: data.pais || null,
          provincia: data.provincia || null,
          ciudad: data.ciudad || null,
          titulo: data.titulo || null,
          tarifa: data.tarifa ? Number(data.tarifa) : null,
          moneda: data.moneda || "ARS",
          skills: data.skills || [],
          perfil: data.descripcion || null,
          disponible: true,
          lat: data.lat || null,
          lng: data.lng || null,
          radio: Number(data.radio) || 30,
        };
        const result = await supa.upsertProfile(authData.token, profileData);
        console.log("Resultado upsertProfile:", result);
      } else {
        console.warn("Sin authData — no se pudo guardar perfil", authData);
      }
      setPhase("app");
    }}/>
  );

  return (
    <MainApp userRol={userRol} userData={userData} authData={authData} obras={obras} setObrasRoot={setObras}
      esPrimerLogin={primerLogin}
      onLogout={()=>{
        supa.clearSession();
        setPhase("welcome");
        setUserRol(null);
        setUserData({});
        setAuthData(null);
        setObras(OBRAS_SEED);
        setPrimerLogin(false);
      }}/>
  );
}
