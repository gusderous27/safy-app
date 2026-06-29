import { useState, useRef, useEffect } from "react";

// ─── SUPABASE ────────────────────────────────────────────────────────────────

const SUPA_URL = "https://ojslewybmcayfmvuhqsc.supabase.co";
const SUPA_KEY = "sb_publishable_JmENOILK3rOPz9-0IqcA1A_1or2An5-";

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

  async getUser(token) {
    const r = await fetch(SUPA_URL + "/auth/v1/user", {
      headers: { ...this.headers, "Authorization": "Bearer " + token }
    });
    return r.json();
  },

  async upsertProfile(token, profile) {
    const r = await fetch(SUPA_URL + "/rest/v1/profiles", {
      method: "POST",
      headers: { ...this.headers, "Authorization": "Bearer " + token, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify(profile)
    });
    if (!r.ok) { const e = await r.text(); return { error: e }; }
    return { data: true };
  },

  async getProfile(token, userId) {
    const r = await fetch(SUPA_URL + "/rest/v1/profiles?id=eq." + userId + "&select=*", {
      headers: { ...this.headers, "Authorization": "Bearer " + token }
    });
    const d = await r.json();
    return Array.isArray(d) ? d[0] : null;
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

  async updateJob(token, id, data) {
    const r = await fetch(SUPA_URL + "/rest/v1/jobs?id=eq." + id, {
      method: "PATCH",
      headers: { ...this.headers, "Authorization": "Bearer " + token },
      body: JSON.stringify(data)
    });
    return r.ok;
  },

  async deleteJob(token, id) {
    const r = await fetch(SUPA_URL + "/rest/v1/jobs?id=eq." + id, {
      method: "DELETE",
      headers: { ...this.headers, "Authorization": "Bearer " + token }
    });
    return r.ok;
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
  US:{disciplina:"Occupational Health & Safety",abrev:"OHS"},
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

// Profesionales demo (seed) — se reemplazarán con data real de Supabase
const profesionales = [
  {id:"demo-1",nombre:"Carla",apellido:"Méndez",titulo:"lic",ciudad:"Buenos Aires",pais:"AR",
   distancia:3,tarifa:2800,moneda:"ARS",disponible:true,
   perfil:"8 años en obra civil y plantas industriales. Especialidad en altura y espacios confinados.",
   obras:["Torre Catalinas Norte","Planta YPF Ensenada"],
   avatar:"CM",color:"#E63946",skills:["Trabajo en Altura","NFPA 70E","Ergonomía"],
   rating:4.8,trabajos:34,email:"carla.mendez@gmail.com",tel:"+54 9 11 4421-0033"},
  {id:"demo-2",nombre:"Roberto",apellido:"Funes",titulo:"tec",ciudad:"Rosario",pais:"AR",
   distancia:12,tarifa:1900,moneda:"ARS",disponible:true,
   perfil:"6 años en obras viales y minería. Manejo de explosivos certificado.",
   obras:["Ruta Nacional 9","Viaducto Mendoza"],
   avatar:"RF",color:"#2A9D8F",skills:["Seguridad Vial","Análisis de Riesgos"],
   rating:4.6,trabajos:21,email:"rfunes@gmail.com",tel:"+54 9 341 558-2290"},
  {id:"demo-3",nombre:"Sofía",apellido:"Peralta",titulo:"ing",ciudad:"Córdoba",pais:"AR",
   distancia:7,tarifa:35,moneda:"USD",disponible:false,
   perfil:"12 años. Especialista en riesgo eléctrico y auditorías. Certificada IRAM.",
   obras:["EPEC Central Térmica","Volkswagen Pacheco"],
   avatar:"SP",color:"#7B2D8B",skills:["Riesgo Eléctrico","ISO 45001","Auditorías"],
   rating:4.9,trabajos:57,email:"sofia.peralta@gmail.com",tel:"+54 9 351 442-1100"},
  {id:"demo-4",nombre:"Diego",apellido:"Acuña",titulo:"tec",ciudad:"Mendoza",pais:"AR",
   distancia:5,tarifa:2100,moneda:"ARS",disponible:true,
   perfil:"4 años en industria vitivinícola. Certificado HACCP.",
   obras:["Bodega Catena Zapata","Planta Nestlé"],
   avatar:"DA",color:"#F4A261",skills:["Ergonomía","Capacitaciones"],
   rating:4.4,trabajos:18,email:"diegoacuna@gmail.com",tel:"+54 9 261 334-7788"},
  {id:"demo-5",nombre:"Valeria",apellido:"Sosa",titulo:"lic",ciudad:"La Plata",pais:"AR",
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
    ? <img src={foto} alt={init} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,display:"block",border:"none",background:color||"#1a1a2e"}}/>
    : <div style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:size*.32}}>{init}</div>;

const Chip = ({children,selected,onClick,color="#1a1a2e"}) => (
  <span onClick={onClick} style={{padding:"5px 12px",borderRadius:99,fontSize:12,fontWeight:600,color:selected?"#fff":color,background:selected?color:"#f0f0f8",border:"1.5px solid "+(selected?color:"transparent"),cursor:onClick?"pointer":"default",userSelect:"none",display:"inline-block"}}>
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
      style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",fontSize:14,color:"#1a1a2e",outline:"none",background:"#fff",boxSizing:"border-box"}}/>
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
      style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",fontSize:14,color:value?"#1a1a2e":"#aaa",outline:"none",background:"#fff",appearance:"none",WebkitAppearance:"none",boxSizing:"border-box",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center"}}>
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
      style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",fontSize:14,color:"#1a1a2e",outline:"none",background:"#fff",resize:"vertical",boxSizing:"border-box",lineHeight:1.5,fontFamily:"inherit"}}/>
    {example&&<div style={{marginTop:8,background:"#fffbf3",borderRadius:10,padding:"10px 12px",borderLeft:"3px solid #F4A261"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#c97e1a",marginBottom:3}}>Ejemplo</div>
      <div style={{fontSize:12,color:"#666",lineHeight:1.55,fontStyle:"italic"}}>{example}</div>
    </div>}
  </div>
);

const Btn = ({children,onClick,disabled,outline}) => (
  <button onClick={onClick} disabled={disabled}
    style={{width:"100%",padding:14,borderRadius:14,border:outline?"1.5px solid #1a1a2e":"none",background:disabled?"#d0d0e0":outline?"#fff":"#1a1a2e",color:disabled?"#aaa":outline?"#1a1a2e":"#fff",fontWeight:800,fontSize:15,cursor:disabled?"not-allowed":"pointer",marginTop:8,fontFamily:"inherit"}}>
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
      <Sel label="País *" value={pais||""} onChange={v=>onChange({pais:v,provincia:"",ciudad:""})} options={[{v:"",l:"Seleccioná tu país..."},...PAISES]}/>
      {pais&&provs.length>0&&(
        <Sel label="Provincia / Estado *" value={provincia||""} onChange={v=>onChange({pais,provincia:v,ciudad:""})} options={[{v:"",l:"Seleccioná provincia..."},...provs.map(p=>({v:p,l:p}))]}/>
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

const Honorarios = ({value,moneda,onValue,onMoneda}) => (
  <div style={{marginBottom:18}}>
    <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:6}}>Honorarios por hora</label>
    <div style={{display:"flex",gap:8,marginBottom:10}}>
      {["ARS","USD"].map(m=>(
        <button key={m} onClick={()=>onMoneda(m)}
          style={{flex:1,padding:"10px",borderRadius:12,fontWeight:700,fontSize:14,border:moneda===m?"2px solid #1a1a2e":"2px solid #e0e0ef",background:moneda===m?"#1a1a2e":"#fff",color:moneda===m?"#fff":"#555",cursor:"pointer",fontFamily:"inherit"}}>
          {m==="ARS"?"$ Pesos":"U$D Dólares"}
        </button>
      ))}
    </div>
    <div style={{position:"relative"}}>
      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20,fontWeight:800,color:"#aaa"}}>{moneda==="USD"?"U$D":"$"}</sp
