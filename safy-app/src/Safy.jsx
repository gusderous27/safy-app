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
      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20,fontWeight:800,color:"#aaa"}}>{moneda==="USD"?"U$D":"$"}</span>
      <input type="number" min={0} value={value||""} onChange={e=>onValue(e.target.value)} placeholder="0"
        style={{width:"100%",padding:"14px 14px 14px 52px",borderRadius:12,border:"1.5px solid #e0e0ef",fontSize:22,fontWeight:800,color:"#1a1a2e",outline:"none",background:"#fff",boxSizing:"border-box"}}/>
    </div>
    <div style={{fontSize:12,color:"#aaa",marginTop:6}}>Dejá en 0 si preferís no indicarlo</div>
  </div>
);

const SkillSelector = ({selected,onChange,label}) => {
  const [otroVal,setOtroVal] = useState("");
  const [showOtro,setShowOtro] = useState(false);
  const toggle = s => onChange(selected.includes(s)?selected.filter(x=>x!==s):[...selected,s]);
  const addOtro = () => { const v=otroVal.trim(); if(v&&!selected.includes(v)){onChange([...selected,v]);setOtroVal("");setShowOtro(false);} };
  const custom = selected.filter(s=>!SKILLS.includes(s));
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>{label}</label>
        <span style={{fontSize:11,color:"#888"}}>{selected.length} sel.</span>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {SKILLS.map(s=><Chip key={s} selected={selected.includes(s)} onClick={()=>toggle(s)}>{s}</Chip>)}
        {custom.map(s=>(<Chip key={s} selected color="#7B2D8B">{s} <span onClick={e=>{e.stopPropagation();onChange(selected.filter(x=>x!==s))}} style={{marginLeft:4,cursor:"pointer"}}>x</span></Chip>))}
        <Chip onClick={()=>setShowOtro(true)} color="#7B2D8B">+ Otro</Chip>
      </div>
      {showOtro&&(
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <input value={otroVal} onChange={e=>setOtroVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addOtro()} autoFocus placeholder="Tu skill..."
            style={{flex:1,padding:"10px 13px",borderRadius:12,border:"1.5px solid #7B2D8B",fontSize:13,outline:"none"}}/>
          <button onClick={addOtro} style={{padding:"10px 16px",borderRadius:12,background:"#7B2D8B",color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+</button>
          <button onClick={()=>setShowOtro(false)} style={{padding:"10px",borderRadius:12,background:"#f0f0f8",border:"none",cursor:"pointer",fontFamily:"inherit"}}>x</button>
        </div>
      )}
    </div>
  );
};

const ObrasInput = ({obras,onChange}) => {
  const [val,setVal] = useState("");
  const add = () => { if(val.trim()){onChange([...obras,val.trim()]);setVal("");} };
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <label style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>Obras / trabajos destacados</label>
        <span style={{fontSize:11,color:"#aaa"}}>Opcional</span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Ej: Torre Catalinas Norte 2023"
          style={{flex:1,padding:"11px 14px",borderRadius:12,border:"1.5px solid #e0e0ef",fontSize:13,outline:"none"}}/>
        <button onClick={add} style={{padding:"11px 18px",borderRadius:12,background:"#1a1a2e",color:"#fff",border:"none",fontWeight:700,cursor:"pointer",fontSize:18,fontFamily:"inherit"}}>+</button>
      </div>
      {obras.map((o,i)=>(
        <div key={i} style={{background:"#f8f8fc",borderRadius:10,padding:"9px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:"#444",marginBottom:6}}>
          {o}
          <span onClick={()=>onChange(obras.filter((_,j)=>j!==i))} style={{color:"#E63946",cursor:"pointer",fontWeight:700,fontSize:16,marginLeft:8}}>x</span>
        </div>
      ))}
    </div>
  );
};

const ToggleSeguro = ({pais,value,onChange,esOferta=false}) => {
  const nombreSeguro = getSeguro(pais||"AR");
  const opSi = esOferta?"Si, se ofrece cobertura":"Si, tengo cobertura";
  const opNo = esOferta?"No se ofrece cobertura":"No tengo cobertura";
  return (
    <div style={{marginBottom:18}}>
      <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>
        {esOferta?"Esta oferta incluye cobertura de seguro":"Cobertura de seguro"}
      </label>
      <div style={{fontSize:12,color:"#888",marginBottom:10}}>{nombreSeguro}</div>
      <div style={{display:"flex",gap:10}}>
        {[{v:true,l:opSi},{v:false,l:opNo}].map(item=>(
          <button key={String(item.v)} onClick={()=>onChange(item.v)}
            style={{flex:1,padding:"11px 8px",borderRadius:12,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:value===item.v?700:400,textAlign:"center",lineHeight:1.3,border:value===item.v?(item.v?"1.5px solid #2A9D8F":"1.5px solid #E63946"):"1.5px solid #e0e0ef",background:value===item.v?(item.v?"#e8f7f5":"#fdecea"):"#fff",color:value===item.v?(item.v?"#2A9D8F":"#E63946"):"#888"}}>
            <div style={{fontSize:18,marginBottom:4}}>{item.v?"✅":"❌"}</div>
            {item.l}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── GOOGLE LOGO ─────────────────────────────────────────────────────────────

const GLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" style={{flexShrink:0}}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

// ─── SPLASH ───────────────────────────────────────────────────────────────────

const SplashScreen = ({onDone}) => {
  const [anim,setAnim] = useState("s");
  useEffect(()=>{
    const t1=setTimeout(()=>setAnim("af"),700);
    const t2=setTimeout(()=>setAnim("y"),1300);
    const t3=setTimeout(()=>setAnim("tag"),1900);
    const t4=setTimeout(()=>setAnim("out"),2700);
    const t5=setTimeout(()=>onDone(),3400);
    return ()=>[t1,t2,t3,t4,t5].forEach(clearTimeout);
  },[]);
  const fading = anim==="out";
  return (
    <div style={{position:"fixed",inset:0,background:"#1a1a2e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",maxWidth:420,margin:"0 auto",zIndex:9999,opacity:fading?0:1,transition:fading?"opacity 0.9s ease":"none",pointerEvents:fading?"none":"auto"}}>
      <style>{`@keyframes sZoom{0%{transform:scale(4.5);opacity:0}40%{opacity:1}100%{transform:scale(1);opacity:1}}@keyframes slideInLeft{from{transform:translateX(-18px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes fadeInTag{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes dotPulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{display:"flex",alignItems:"center",fontFamily:"inherit",letterSpacing:-3}}>
        <span style={{fontSize:96,fontWeight:800,color:"#fff",lineHeight:1,display:"inline-block",animation:"sZoom 0.65s cubic-bezier(0.22,1,0.36,1) forwards"}}>S</span>
        {(anim==="af"||anim==="y"||anim==="tag"||anim==="out")&&(
          <span style={{fontSize:96,fontWeight:800,lineHeight:1,display:"inline-block",animation:"slideInLeft 0.35s cubic-bezier(0.22,1,0.36,1) forwards"}}>
            <span style={{color:"#fff"}}>af</span>
            <span style={{color:anim==="y"||anim==="tag"||anim==="out"?"#F4A261":"#fff",transition:"color 0.3s ease"}}>y</span>
          </span>
        )}
      </div>
      {(anim==="tag"||anim==="out")&&(
        <div style={{fontSize:13,color:"#7788aa",textAlign:"center",lineHeight:1.5,marginTop:16,animation:"fadeInTag 0.4s ease forwards"}}>
          El match inteligente para profesionales<br/>de Seguridad, Higiene y Medio Ambiente
        </div>
      )}
      <div style={{position:"absolute",bottom:52,display:"flex",gap:8,opacity:(anim==="tag"||anim==="out")?1:0,transition:"opacity 0.5s ease"}}>
        {[0,1,2].map(i=>(<div key={i} style={{width:i===1?8:5,height:i===1?8:5,borderRadius:"50%",background:i===1?"#F4A261":"rgba(255,255,255,0.3)",animation:(anim==="tag"||anim==="out")?"dotPulse 1.4s ease "+(i*0.22)+"s infinite":"none"}}/>))}
      </div>
    </div>
  );
};

// ─── WELCOME ──────────────────────────────────────────────────────────────────

const WelcomeScreen = ({onEntrar,onRegistrarse,visible=true}) => (
  <div style={{flex:1,display:"flex",flexDirection:"column",background:"#1a1a2e",minHeight:"100vh"}}>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px"}}>
      <div style={{fontWeight:800,fontSize:72,color:"#fff",letterSpacing:-4,lineHeight:1,marginBottom:8}}>
        S<span style={{color:"#F4A261"}}>afy</span>
      </div>
      <div style={{fontSize:15,color:"#7788aa",textAlign:"center",lineHeight:1.6,marginBottom:48,maxWidth:280}}>
        El match inteligente para profesionales de Seguridad, Higiene y Medio Ambiente
      </div>
      <div style={{width:"100%",maxWidth:320}}>
        <button onClick={onRegistrarse} style={{width:"100%",padding:"16px",borderRadius:16,border:"none",background:"#F4A261",color:"#1a1a2e",fontWeight:800,fontSize:16,cursor:"pointer",marginBottom:12,fontFamily:"inherit"}}>
          Crear cuenta gratis
        </button>
        <button onClick={onEntrar} style={{width:"100%",padding:"16px",borderRadius:16,border:"1.5px solid rgba(255,255,255,0.2)",background:"transparent",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>
          Ya tengo cuenta
        </button>
      </div>
    </div>
    <div style={{textAlign:"center",padding:"16px 32px 32px",fontSize:12,color:"rgba(119,136,170,0.6)",lineHeight:1.5}}>
      Para profesionales SyH/MA y empresas de toda América Latina y España
    </div>
  </div>
);

// ─── LOGIN / REGISTRO CON SUPABASE ────────────────────────────────────────────

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
        // Auto-login after signup
        const loginRes = await supa.signInEmail(email, password);
        if(loginRes.access_token) {
          onLogin({ token: loginRes.access_token, user: loginRes.user, email });
        } else { setError("Cuenta creada. Verificá tu email para ingresar."); }
      } else {
        const res = await supa.signInEmail(email, password);
        if(res.access_token) {
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
      <div style={{background:"#fffbf3",borderRadius:14,padding:"12px 16px",marginBottom:20,border:"1.5px solid #F4A261"}}>
        <div style={{fontSize:12,color:"#c97e1a",fontWeight:700,marginBottom:4}}>🔐 Auth real con Supabase</div>
        <div style={{fontSize:12,color:"#666",lineHeight:1.4}}>
          Tu cuenta se guarda de forma segura. Email + contraseña o link mágico sin contraseña.
        </div>
      </div>
      <button onClick={()=>setMode("email")}
        style={{width:"100%",padding:"14px",borderRadius:14,border:"none",background:"#1a1a2e",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,fontFamily:"inherit"}}>
        ✉️ Continuar con email
      </button>
      <button onClick={()=>{setMode("email");setEmail("");}}
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
      <div key={i} style={{flex:1,height:4,borderRadius:99,background:i<step?"#F4A261":"rgba(255,255,255,0.3)",transition:"background .3s"}}/>
    ))}
  </div>
);

const OBHead = ({step,total,onBack}) => (
  <div style={{background:"#1a1a2e",padding:"14px 20px 0",flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#aaa",fontSize:24,cursor:"pointer",padding:0,lineHeight:1,fontFamily:"inherit"}}>‹</button>
      <span style={{flex:1,fontWeight:800,fontSize:18,color:"#fff",letterSpacing:-.5}}>S<span style={{color:"#F4A261"}}>afy</span></span>
      <span style={{fontSize:12,color:"#aaa",fontWeight:600}}>{step} / {total}</span>
    </div>
    <ProgBar step={step} total={total}/>
  </div>
);

const StepRol = ({onSelect}) => (
  <div style={{padding:"32px 20px"}}>
    <div style={{textAlign:"center",marginBottom:32}}>
      <div style={{fontSize:36,marginBottom:12}}>👋</div>
      <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:6}}>¿Cómo vas a usar Safy?</div>
      <div style={{fontSize:14,color:"#888",lineHeight:1.5}}>Esto define tu perfil y lo que ves en la app</div>
    </div>
    {[
      {rol:"profesional",icon:"🦺",title:"Soy profesional SyH/MA",desc:"Busco trabajo, obras y proyectos. Quiero que las empresas me encuentren."},
      {rol:"empresa",icon:"🏗️",title:"Soy empresa / empleador",desc:"Busco profesionales de seguridad para mis obras y proyectos."},
    ].map(({rol,icon,title,desc})=>(
      <button key={rol} onClick={()=>onSelect(rol)}
        style={{width:"100%",background:"#fff",border:"2px solid #e0e0ef",borderRadius:18,padding:"20px 16px",textAlign:"left",cursor:"pointer",marginBottom:12,fontFamily:"inherit",display:"flex",gap:14,alignItems:"flex-start"}}>
        <span style={{fontSize:32,flexShrink:0}}>{icon}</span>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:"#1a1a2e",marginBottom:4}}>{title}</div>
          <div style={{fontSize:13,color:"#888",lineHeight:1.4}}>{desc}</div>
        </div>
      </button>
    ))}
  </div>
);

const StepPro1 = ({data,set,onNext}) => {
  const [n,setN] = useState(data.nombre||"");
  const [ap,setAp] = useState(data.apellido||"");
  const [tel,setTel] = useState(data.tel||"");
  const [geo,setGeo] = useState({pais:data.pais||"",provincia:data.provincia||"",ciudad:data.ciudad||""});
  const [ra,setRa] = useState(data.radio||"");
  const [geoLoading,setGeoLoading] = useState(false);
  const ok = n && ap && geo.ciudad;

  const detectarUbicacion = () => {
    if(!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        // Guardamos coords para uso futuro, por ahora solo feedback
        setGeoLoading(false);
        alert("Ubicación detectada. Completá tu ciudad manualmente por ahora — en la próxima versión se autocompletará.");
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  };

  const next = () => { set({...data,nombre:n,apellido:ap,tel,...geo,radio:ra}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Tus datos personales</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Aparecerán en tu perfil público</div>
      <Inp label="Nombre *" placeholder="Ej: Gustavo" value={n} onChange={setN}/>
      <Inp label="Apellido *" placeholder="Ej: De Rose" value={ap} onChange={setAp}/>
      <Inp label="Teléfono" optional type="tel" placeholder="+54 9 11..." value={tel} onChange={setTel}/>
      <GeoSel pais={geo.pais} provincia={geo.provincia} ciudad={geo.ciudad} onChange={setGeo}/>
      <button onClick={detectarUbicacion} disabled={geoLoading}
        style={{width:"100%",padding:"10px",borderRadius:12,border:"1.5px dashed #2A9D8F",background:"transparent",color:"#2A9D8F",fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:16,fontFamily:"inherit"}}>
        {geoLoading?"Detectando...":"📍 Detectar mi ubicación"}
      </button>
      <Inp label="Radio de trabajo (km)" optional type="number" placeholder="Ej: 30" value={ra} onChange={setRa}/>
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
    {v:"",l:"Seleccioná tu título en "+t.abrev+"..."},
    {v:"no_aplica",l:"No aplica"},
    {v:"est_syh",l:"Estudiante de "+t.disciplina},
    {v:"tec_syh",l:"Técnico en "+t.disciplina},
    {v:"lic_syh",l:"Licenciado en "+t.disciplina},
    {v:"ing_syh",l:"Ingeniero en "+t.disciplina},
    {v:"aud_syh",l:"Auditor en "+t.abrev},
    ...(pais==="US"?[{v:"osha30_con",l:"OSHA 30 — Construcción"},{v:"osha30_ind",l:"OSHA 30 — Industria General"},{v:"iso45001",l:"Specialist ISO 45001"}]:[]),
  ];
  const opsMA = [
    {v:"",l:"Sin título en MA (opcional)"},{v:"no_aplica",l:"No aplica"},
    {v:"est_ma",l:"Estudiante de Ciencias Ambientales"},{v:"tec_ma",l:"Técnico en Medio Ambiente"},
    {v:"lic_ma",l:"Licenciado en Ciencias Ambientales"},{v:"ing_ma",l:"Ingeniero Ambiental"},
    {v:"gest_ma",l:"Gestor Ambiental"},{v:"aud_ma",l:"Auditor Ambiental"},
  ];
  const next = () => { set({...data,titulo:tit,tituloMA:titMA,experiencia:exp,descripcion:desc}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Tu perfil profesional</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Lo primero que ven las empresas</div>
      <Sel label={"Título en "+t.disciplina+" *"} value={tit} onChange={setTit} options={opsSyH}/>
      <Sel label="Título en Medio Ambiente" optional value={titMA} onChange={setTitMA} options={opsMA}/>
      <Sel label="Años de experiencia" optional value={exp} onChange={setExp}
        options={[{v:"",l:"Seleccioná..."},{v:"<1",l:"Menos de 1 año"},{v:"1-3",l:"1 a 3 años"},{v:"3-5",l:"3 a 5 años"},{v:"5-10",l:"5 a 10 años"},{v:">10",l:"Más de 10 años"}]}/>
      <Txt label="Descripción breve" optional value={desc} onChange={setDesc} hint="Máximo 3 oraciones."
        example="Licenciado en SyH con 5 años en obras de construcción en CABA. Especializado en trabajos en altura y APT."/>
      <Btn onClick={next} disabled={!tit&&!titMA}>Continuar</Btn>
    </div>
  );
};

const StepPro3 = ({data,set,onNext}) => {
  const [skills,setSkills] = useState(data.skills||[]);
  const [sectores,setSectores] = useState(data.sectores||[]);
  const [obras,setObras_] = useState(data.obras||[]);
  const [tarifa,setTarifa] = useState(data.tarifa||"");
  const [moneda,setMoneda] = useState(data.moneda||"ARS");
  const [seguro,setSeguro] = useState(data.seguro!==undefined?data.seguro:null);
  const next = () => { set({...data,skills,sectores,obras:obras_,tarifa,moneda,seguro}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Skills, disponibilidad y honorarios</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Elegí al menos 2 skills</div>
      <SkillSelector label="Skills principales" selected={skills} onChange={setSkills}/>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:8}}>Sectores <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>Opcional</span></label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {SECTORES.map(s=>(<Chip key={s} selected={sectores.includes(s)} onClick={()=>setSectores(c=>c.includes(s)?c.filter(x=>x!==s):[...c,s])}>{s}</Chip>))}
        </div>
      </div>
      <ObrasInput obras={obras_} onChange={setObras_}/>
      <Honorarios value={tarifa} moneda={moneda} onValue={setTarifa} onMoneda={setMoneda}/>
      <ToggleSeguro pais={data.pais} value={seguro} onChange={setSeguro}/>
      <Btn onClick={next} disabled={skills.length<2}>Ver resumen</Btn>
    </div>
  );
};

const StepEmp1 = ({data,set,onNext}) => {
  const [emp,setEmp] = useState(data.empresa||"");
  const [con,setCon] = useState(data.contacto||"");
  const [tel,setTel] = useState(data.tel||"");
  const [rub,setRub] = useState(data.rubro||"");
  const [geo,setGeo] = useState({pais:data.pais||"",provincia:data.provincia||"",ciudad:data.ciudad||""});
  const ok = emp && con && geo.ciudad;
  const next = () => { set({...data,empresa:emp,contacto:con,tel,rubro:rub,...geo}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Datos de tu empresa</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Los profesionales verán este perfil</div>
      <Inp label="Empresa *" placeholder="Ej: Constructora Omega S.A." value={emp} onChange={setEmp}/>
      <Inp label="Contacto *" placeholder="Tu nombre y apellido" value={con} onChange={setCon}/>
      <Inp label="Teléfono" optional placeholder="+54 11..." value={tel} onChange={setTel}/>
      <Sel label="Rubro" optional value={rub} onChange={setRub} options={[{v:"",l:"Seleccioná el rubro..."},...SECTORES.map(s=>({v:s,l:s}))]}/>
      <GeoSel pais={geo.pais} provincia={geo.provincia} ciudad={geo.ciudad} onChange={setGeo}/>
      <Btn onClick={next} disabled={!ok}>Continuar</Btn>
    </div>
  );
};

const StepEmp2 = ({data,set,onNext}) => {
  const [tipo,setTipo] = useState(data.tipoBusqueda||"");
  const [sec,setSec] = useState(data.sectorObra||"");
  const [zona,setZona] = useState(data.zonaObra||"");
  const [pres,setPres] = useState(data.presupuesto||"");
  const [mon,setMon] = useState(data.moneda||"ARS");
  const [seguro,setSeguro] = useState(data.seguro!==undefined?data.seguro:null);
  const [sreq,setSreq] = useState(data.skillsReq||[]);
  const [desc,setDesc] = useState(data.descripcionObra||"");
  const ok = tipo;
  const next = () => { set({...data,tipoBusqueda:tipo,sectorObra:sec,zonaObra:zona,presupuesto:pres,moneda:mon,seguro,skillsReq:sreq,descripcionObra:desc}); onNext(); };
  return (
    <div style={{padding:"24px 20px 32px"}}>
      <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:3}}>Qué profesional buscás</div>
      <div style={{color:"#888",fontSize:13,marginBottom:20}}>Filtramos los candidatos más relevantes</div>
      <div style={{marginBottom:18}}>
        <label style={{display:"block",fontSize:13,fontWeight:700,color:"#1a1a2e",marginBottom:8}}>Título requerido *</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {[{v:"est",l:"Estudiante"},{v:"tec",l:"Técnico"},{v:"lic",l:"Licenciado"},{v:"ing",l:"Ingeniero"},{v:"cualquiera",l:"Cualquiera"}].map(({v,l})=>(
            <Chip key={v} selected={tipo===v} onClick={()=>setTipo(v)}>{l}</Chip>
          ))}
        </div>
      </div>
      <Sel label="Sector" optional value={sec} onChange={setSec} options={[{v:"",l:"Seleccioná..."},...SECTORES.map(s=>({v:s,l:s}))]}/>
      <Inp label="Zona de trabajo" optional placeholder="Ej: Palermo, CABA" value={zona} onChange={setZona}/>
      <Txt label="Descripción del puesto" optional value={desc} onChange={setDesc}
        example="Obra de construcción de torre en Caballito. Buscamos Técnico para elaboración de Programa de Seguridad y recorridas diarias. Duración: 4 meses."/>
      <SkillSelector label="Skills requeridos" selected={sreq} onChange={setSreq}/>
      <Honorarios value={pres} moneda={mon} onValue={setPres} onMoneda={setMon}/>
      <ToggleSeguro pais={data.pais} value={seguro} onChange={setSeguro} esOferta={true}/>
      <Btn onClick={next} disabled={!ok}>Ver resumen</Btn>
    </div>
  );
};

const ResumenOnboarding = ({rol,data,onConfirm,loading}) => {
  const esPro = rol==="profesional";
  const t = getT(data.pais||"AR");
  return (
    <div style={{padding:"24px 20px 40px"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:40,marginBottom:8}}>✅</div>
        <div style={{fontWeight:800,fontSize:21,color:"#1a1a2e",marginBottom:4}}>¡Todo listo!</div>
        <div style={{fontSize:13,color:"#888"}}>Revisá tu perfil antes de publicarlo</div>
      </div>
      <div style={{background:"#fff",borderRadius:16,padding:18,marginBottom:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
        <div style={{fontWeight:700,fontSize:13,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>
          {esPro?"Tu perfil":"Tu empresa"}
        </div>
        {esPro?([
          ["Nombre", (data.nombre||""+" "+(data.apellido||"")).trim()],
          ["Título", TITULOS[data.titulo]||data.titulo||"—"],
          ["Ciudad", [data.ciudad,data.provincia,PAISES.find(p=>p.v===data.pais)?.l].filter(Boolean).join(", ")||"—"],
          ["Skills", (data.skills||[]).slice(0,3).join(", ")||(data.skills?.length>3?" y más":"—")],
          ["Honorarios", data.tarifa?((data.moneda==="USD"?"U$D":"$")+data.tarifa+"/h"):"No indicado"],
        ]):(([
          ["Empresa", data.empresa||"—"],
          ["Contacto", data.contacto||"—"],
          ["Ciudad", [data.ciudad,data.provincia].filter(Boolean).join(", ")||"—"],
          ["Busca", data.tipoBusqueda?({est:"Estudiante",tec:"Técnico",lic:"Licenciado",ing:"Ingeniero",cualquiera:"Cualquiera"}[data.tipoBusqueda]||data.tipoBusqueda):"—"],
          ["Sector", data.sectorObra||"—"],
        ]))).map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:8,paddingBottom:8,borderBottom:"1px solid #f5f5f5"}}>
            <span style={{fontSize:13,color:"#888",fontWeight:600}}>{k}</span>
            <span style={{fontSize:13,color:"#1a1a2e",fontWeight:700,textAlign:"right",maxWidth:"60%"}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{background:"#fffbf3",borderRadius:14,padding:"12px 16px",marginBottom:20,border:"1.5px solid #F4A261"}}>
        <div style={{fontSize:12,color:"#c97e1a",lineHeight:1.5}}>
          💾 Tu perfil se guardará en Supabase y estará disponible desde cualquier dispositivo.
        </div>
      </div>
      <Btn onClick={onConfirm} disabled={loading}>
        {loading?"Guardando perfil...":"Publicar mi perfil →"}
      </Btn>
    </div>
  );
};

const Onboarding = ({authData,onComplete}) => {
  const [step,setStep] = useState(0);
  const [rol,setRol] = useState(null);
  const [data,setData] = useState({ email: authData?.email || "" });
  const [saving,setSaving] = useState(false);

  const pasosPro = [StepPro1, StepPro2, StepPro3];
  const pasosEmp = [StepEmp1, StepEmp2];

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const profileData = {
        id: authData.user?.id,
        rol,
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
        perfil: data.descripcion || data.descripcionObra || null,
        disponible: true,
      };
      const res = await supa.upsertProfile(authData.token, profileData);
      if(res.error) {
        console.error("Error guardando perfil:", res.error);
      }
      // Si es empresa, crear primer aviso en Supabase
      if(rol==="empresa" && data.tipoBusqueda) {
        const empNombre = data.empresa || data.contacto || "Mi Empresa";
        await supa.createJob(authData.token, {
          empresa_id: authData.user?.id,
          empresa: empNombre,
          tipo: data.sectorObra || "Búsqueda",
          ciudad: data.zonaObra || data.ciudad || "",
          descripcion: data.descripcionObra || ("Buscamos "+data.tipoBusqueda+" en "+(data.sectorObra||"SyH")),
          presupuesto: Number(data.presupuesto) || 0,
          moneda: data.moneda || "ARS",
          urgente: data.urgencia === "ya",
          estado: "activa",
        });
      }
    } catch(e) { console.error(e); }
    setSaving(false);
    onComplete(rol, data);
  };

  if(step===0) return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",minHeight:"100vh",maxWidth:420,margin:"0 auto",overflowY:"auto"}}>
      <style>{CSS}</style>
      <div style={{background:"#1a1a2e",padding:"16px 20px"}}>
        <div style={{fontWeight:800,fontSize:18,color:"#fff"}}>S<span style={{color:"#F4A261"}}>afy</span></div>
      </div>
      <StepRol onSelect={r=>{setRol(r);setStep(1);}}/>
    </div>
  );

  const pasos = rol==="profesional"?pasosPro:pasosEmp;
  const total = pasos.length+1;
  const isResumen = step===total;

  return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",minHeight:"100vh",maxWidth:420,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      <style>{CSS}</style>
      <OBHead step={step} total={total} onBack={()=>setStep(s=>Math.max(0,s-1))}/>
      <div style={{flex:1,overflowY:"auto"}}>
        {isResumen
          ? <ResumenOnboarding rol={rol} data={data} onConfirm={handleConfirm} loading={saving}/>
          : React.createElement(pasos[step-1],{data,set:setData,onNext:()=>setStep(s=>s+1)})
        }
      </div>
    </div>
  );
};

// ─── SWIPE CARD ───────────────────────────────────────────────────────────────

const SwipeCard = ({item,type,onSwipe,isTop}) => {
  const [dragX,setDragX] = useState(0);
  const [dragging,setDragging] = useState(false);
  const [startX,setStartX] = useState(0);
  const ref = useRef(null);
  const isPro = type==="profesional";
  const onStart = (cx) => { if(!isTop) return; setDragging(true); setStartX(cx-dragX); };
  const onMove = (cx) => { if(!dragging) return; setDragX(cx-startX); };
  const onEnd = () => {
    if(!dragging) return; setDragging(false);
    if(Math.abs(dragX)>80) { onSwipe(dragX>0?"yes":"no"); setDragX(0); }
    else setDragX(0);
  };
  const rot = dragX*0.08;
  const sym = item.moneda==="USD"?"U$D":"$";
  return (
    <div ref={ref}
      onMouseDown={e=>onStart(e.clientX)} onMouseMove={e=>onMove(e.clientX)} onMouseUp={onEnd} onMouseLeave={onEnd}
      onTouchStart={e=>onStart(e.touches[0].clientX)} onTouchMove={e=>onMove(e.touches[0].clientX)} onTouchEnd={onEnd}
      style={{background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 8px 32px rgba(26,26,46,0.13)",userSelect:"none",cursor:isTop?"grab":"default",transform:"rotate("+rot+"deg) translateX("+dragX+"px)",transition:dragging?"none":"transform 0.3s ease",position:"relative"}}>
      {isTop&&dragX>40&&<div style={{position:"absolute",top:20,left:20,zIndex:10,background:"#2A9D8F",borderRadius:99,padding:"8px 18px",fontWeight:800,fontSize:18,color:"#fff",border:"3px solid #fff",transform:"rotate(-15deg)"}}>MATCH ✓</div>}
      {isTop&&dragX<-40&&<div style={{position:"absolute",top:20,right:20,zIndex:10,background:"#E63946",borderRadius:99,padding:"8px 18px",fontWeight:800,fontSize:18,color:"#fff",border:"3px solid #fff",transform:"rotate(15deg)"}}>PASO ✕</div>}
      <div style={{height:6,background:item.color}}/>
      <div style={{padding:18}}>
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
          <Av init={item.avatar||(isPro?(item.nombre[0]+item.apellido[0]).toUpperCase():item.empresa.slice(0,2).toUpperCase())} color={item.color} size={60} foto={item.foto}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:18,color:"#1a1a2e"}}>{isPro?item.nombre+" "+item.apellido:item.empresa}</div>
            <div style={{fontSize:13,color:"#888",marginBottom:4}}>{isPro?(TITULOS[item.titulo]||item.titulo)+" · "+item.ciudad:item.tipo+" · "+item.ciudad}</div>
            {isPro&&item.rating&&<div style={{display:"flex",alignItems:"center",gap:4}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:14,color:n<=Math.round(item.rating)?"#F4A261":"#e0e0ef"}}>★</span>)}<span style={{fontSize:12,fontWeight:700,color:"#1a1a2e",marginLeft:4}}>{item.rating}</span></div>}
          </div>
        </div>
        <p style={{fontSize:13,color:"#555",lineHeight:1.55,margin:"0 0 12px"}}>{isPro?item.perfil:item.descripcion}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {(isPro?item.skills:(item.requisitos||[])).slice(0,4).map((s,i)=><Chip key={i}>{s}</Chip>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid #f0f0f0"}}>
          <div>
            <span style={{fontSize:20,fontWeight:800,color:"#1a1a2e"}}>{sym}{(item.tarifa||item.presupuesto||0).toLocaleString()}</span>
            <span style={{fontSize:13,color:"#888",marginLeft:4}}>/h · {item.moneda}</span>
          </div>
          {isPro&&item.disponible!==undefined&&<span style={{fontSize:12,fontWeight:700,padding:"4px 10px",borderRadius:99,background:item.disponible?"#e8f7f5":"#f8f8fc",color:item.disponible?"#2A9D8F":"#888"}}>{item.disponible?"Disponible":"No disponible"}</span>}
        </div>
      </div>
    </div>
  );
};

const MatchPop = ({item,userData,onClose,onGoToMatches}) => {
  const myInit = userData.nombre?(userData.nombre[0]+((userData.apellido||" ")[0])).toUpperCase():(userData.empresa||"??").slice(0,2).toUpperCase();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,.92)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:24,padding:28,maxWidth:340,width:"100%",textAlign:"center",animation:"popIn .3s ease"}}>
        <div style={{fontSize:44,marginBottom:6}}>🤝</div>
        <div style={{fontWeight:800,fontSize:22,color:"#1a1a2e",marginBottom:4}}>Nueva conexión!</div>
        <div style={{color:"#666",fontSize:13,marginBottom:20,lineHeight:1.5}}>Vos y <strong style={{color:"#1a1a2e"}}>{item.nombre||item.empresa}</strong> confirmaron interés profesional mutuo.</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:20}}>
          <Av init={myInit} color="#1a1a2e" size={52} foto={userData.foto||""}/>
          <div style={{fontSize:26}}>↔</div>
          <Av init={item.avatar||(item.nombre?item.nombre[0]:"?")} color={item.color||"#2A9D8F"} size={52}/>
        </div>
        <div style={{background:"#f8f8fc",borderRadius:14,padding:"14px 16px",marginBottom:20,textAlign:"left"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#aaa",marginBottom:8,textTransform:"uppercase"}}>Contacto de {item.nombre||item.empresa}</div>
          <div style={{fontSize:13,color:"#1a73e8",fontWeight:600,marginBottom:4}}>{item.email||"contacto@safy.app"}</div>
          <div style={{fontSize:13,color:"#1a1a2e",fontWeight:600}}>{item.tel||"—"}</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:"#f0f0f8",color:"#1a1a2e",border:"none",borderRadius:99,padding:"13px 0",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Seguir</button>
          <button onClick={onGoToMatches} style={{flex:1,background:"#1a1a2e",color:"#fff",border:"none",borderRadius:99,padding:"13px 0",fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Ver conexiones</button>
        </div>
      </div>
    </div>
  );
};

// ─── FEED ITEM ────────────────────────────────────────────────────────────────

const FeedItem = ({obra,onPostular,yaPostulado}) => {
  const sym = obra.moneda==="USD"?"U$D":"$";
  return (
    <div style={{background:"#fff",borderRadius:16,marginBottom:14,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
      <div style={{height:5,background:obra.color||"#2A9D8F"}}/>
      <div style={{padding:16}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
          <Av init={obra.avatar||(obra.empresa||"?").slice(0,2).toUpperCase()} color={obra.color||"#2A9D8F"} size={46}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e"}}>{obra.empresa}</div>
              {obra.urgente&&<Chip selected color="#E63946">URGENTE</Chip>}
            </div>
            <div style={{color:"#888",fontSize:12}}>{obra.tipo} · {obra.ciudad}</div>
          </div>
        </div>
        <p style={{fontSize:13,color:"#444",lineHeight:1.5,margin:"0 0 10px"}}>{obra.descripcion}</p>
        {obra.requisitos?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>{obra.requisitos.map((r,i)=><Chip key={i}>{r}</Chip>)}</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:20,fontWeight:800,color:"#1a1a2e"}}>{sym}{(obra.presupuesto||0).toLocaleString()}</span>
            <span style={{fontSize:12,color:"#888"}}>/h · {obra.moneda}</span>
          </div>
          <button onClick={()=>!yaPostulado&&onPostular(obra)}
            style={{background:yaPostulado?"#e8f7f5":"#1a1a2e",color:yaPostulado?"#2A9D8F":"#fff",border:"none",borderRadius:99,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:yaPostulado?"default":"pointer",fontFamily:"inherit"}}>
            {yaPostulado?"Enviado ✓":"Postularme"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── NUEVO AVISO ─────────────────────────────────────────────────────────────

const NuevoAvisoModal = ({userData,authToken,esEmpresa,onPublicar,onClose,avisoEditar}) => {
  const init = avisoEditar||{};
  const [titulo,setTitulo] = useState(init.descripcion||"");
  const [tipo,setTipo] = useState(init.tipo||"");
  const [ciudad,setCiudad] = useState(init.ciudad||userData.ciudad||"");
  const [pres,setPres] = useState(init.presupuesto||"");
  const [moneda,setMoneda] = useState(init.moneda||"ARS");
  const [urgente,setUrgente] = useState(init.urgente||false);
  const [saving,setSaving] = useState(false);
  const ok = titulo && ciudad;

  const publicar = async () => {
    setSaving(true);
    const empNombre = userData.empresa||userData.nombre||"Empresa";
    const nuevo = {
      empresa_id: authToken ? undefined : null,
      empresa: empNombre,
      tipo: tipo||"Búsqueda",
      ciudad, descripcion: titulo,
      presupuesto: Number(pres)||0, moneda, urgente,
      estado: "activa",
    };
    if(authToken && !avisoEditar) {
      nuevo.empresa_id = null; // se setea en backend con auth
      await supa.createJob(authToken, nuevo);
    }
    onPublicar({...nuevo, id: avisoEditar?.id||Date.now(), avatar: empNombre.slice(0,2).toUpperCase(), color:"#2A9D8F", requisitos:[], esMia:true});
    setSaving(false);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,46,.88)",zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",padding:"24px 20px 36px",width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto",animation:"slideUp .25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:18,color:"#1a1a2e"}}>{avisoEditar?"Editar aviso":"Nuevo aviso"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#aaa",cursor:"pointer",fontFamily:"inherit"}}>x</button>
        </div>
        <Inp label="Puesto buscado *" placeholder="Ej: Técnico SyH para obra en altura" value={titulo} onChange={setTitulo}/>
        <Inp label="Tipo de obra / proyecto" optional placeholder="Ej: Obra civil" value={tipo} onChange={setTipo}/>
        <Inp label="Ciudad / Zona *" placeholder="Ej: Palermo, CABA" value={ciudad} onChange={setCiudad}/>
        <Honorarios value={pres} moneda={moneda} onValue={setPres} onMoneda={setMoneda}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f8f8fc",borderRadius:12,padding:"12px 14px",marginBottom:18}}>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>Marcar como urgente</div>
            <div style={{fontSize:11,color:"#888"}}>Badge rojo destacado</div>
          </div>
          <button onClick={()=>setUrgente(u=>!u)} style={{width:44,height:26,borderRadius:99,border:"none",background:urgente?"#E63946":"#e0e0ef",cursor:"pointer",position:"relative",transition:"background .2s",fontFamily:"inherit"}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:4,left:urgente?22:4,transition:"left .2s"}}/>
          </button>
        </div>
        <button onClick={publicar} disabled={!ok||saving}
          style={{width:"100%",padding:14,borderRadius:14,border:"none",background:(!ok||saving)?"#ccc":"#F4A261",color:(!ok||saving)?"#999":"#1a1a2e",fontWeight:800,fontSize:15,cursor:(!ok||saving)?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {saving?"Publicando...":"Publicar aviso"}
        </button>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const MainApp = ({userRol,userData:init0,authData,obras:initObras,setObrasRoot,onLogout}) => {
  const esEmpresa = userRol==="empresa";
  const [tab,setTab] = useState(esEmpresa?"mis_busquedas":"swipe");
  const [vista,setVista] = useState("profesional");
  const [idx,setIdx] = useState(0);
  const [matches,setMatches] = useState([]);
  const [matchPop,setMatchPop] = useState(null);
  const [toast,setToast] = useState(null);
  const [posts,setPosts] = useState([]);
  const [userData,setUserData] = useState(init0);
  const [obras,setObras] = useState(initObras||OBRAS_SEED);
  const [showNuevo,setShowNuevo] = useState(false);
  const [avisoEditar,setAvisoEditar] = useState(null);
  const [dbJobs,setDbJobs] = useState([]);
  const [loadingJobs,setLoadingJobs] = useState(false);
  const [filtros,setFiltros] = useState({sector:"",disponible:false});
  const [showFiltros,setShowFiltros] = useState(false);
  const [adminOpen,setAdminOpen] = useState(false);
  const [adminInput,setAdminInput] = useState("");
  const [adminErr,setAdminErr] = useState(false);

  // Cargar jobs reales de Supabase al montar
  useEffect(()=>{
    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        const jobs = await supa.getJobs(authData?.token);
        if(Array.isArray(jobs) && jobs.length>0) {
          const mapped = jobs.map(j=>({
            id: j.id, empresa: j.empresa||"Empresa", tipo: j.tipo||"Búsqueda",
            ciudad: j.ciudad||"", descripcion: j.descripcion||"",
            presupuesto: j.presupuesto||0, moneda: j.moneda||"ARS",
            urgente: j.urgente||false, estado: j.estado||"activa",
            avatar: (j.empresa||"EM").slice(0,2).toUpperCase(), color:"#2A9D8F",
            requisitos:[], esMia: j.empresa_id===authData?.user?.id,
          }));
          setDbJobs(mapped);
        }
      } catch(e) { console.log("No se pudieron cargar jobs:", e); }
      setLoadingJobs(false);
    };
    loadJobs();
  },[]);

  const todasLasObras = [...dbJobs, ...OBRAS_SEED];
  const misObras = esEmpresa ? [...obras.filter(o=>o.esMia), ...dbJobs.filter(o=>o.esMia)] : [];

  const profesionalesFiltrados = profesionales.filter(p=>{
    if(filtros.sector && !p.skills?.some(s=>s.toLowerCase().includes(filtros.sector.toLowerCase()))) return false;
    if(filtros.disponible && !p.disponible) return false;
    return true;
  });
  const items = vista==="profesional"?profesionalesFiltrados:todasLasObras;
  const remaining = items.slice(idx);

  const toast_ = (msg,color) => { setToast({msg,color:color||"#2A9D8F"}); setTimeout(()=>setToast(null),2500); };

  const swipe = async (dir) => {
    const cur = items[idx];
    if(dir==="yes") {
      const isMatch = Math.random()>.4;
      if(isMatch) {
        setMatches(m=>[...m,cur]);
        setTimeout(()=>setMatchPop(cur),300);
        if(authData?.token && authData?.user?.id) {
          await supa.recordMatch(authData.token, authData.user.id, cur.id);
        }
      } else { toast_("Interés enviado!"); }
    }
    if(authData?.token && authData?.user?.id) {
      await supa.recordSwipe(authData.token, authData.user.id, cur.id, dir);
    }
    setIdx(i=>i+1);
  };

  const tryAdmin = () => {
    if(adminInput===ADMIN_CODE){ setAdminOpen(true); setAdminInput(""); setAdminErr(false); }
    else{ setAdminErr(true); setTimeout(()=>setAdminErr(false),2000); }
  };

  const uInit = userData.nombre?(userData.nombre[0]+((userData.apellido||" ")[0])).toUpperCase():(userData.empresa||"??").slice(0,2).toUpperCase();

  const TABS_PRO = [{id:"swipe",l:"Descubrir",e:"🔍"},{id:"feed",l:"Oportunidades",e:"🏗️"},{id:"matches",l:"Conexiones",e:"🤝"},{id:"perfil",l:"Mi Perfil",e:"👤"}];
  const TABS_EMP = [{id:"mis_busquedas",l:"Mis búsquedas",e:"📋"},{id:"matches",l:"Conexiones",e:"🤝"},{id:"perfil",l:"Mi Perfil",e:"👤"}];
  const TABS = esEmpresa?TABS_EMP:TABS_PRO;

  return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto",position:"relative"}}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#fff",padding:"11px 22px",borderRadius:99,fontWeight:700,fontSize:14,zIndex:9999,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",whiteSpace:"nowrap"}}>{toast.msg}</div>}

      {/* Match popup */}
      {matchPop&&<MatchPop item={matchPop} userData={userData} onClose={()=>setMatchPop(null)} onGoToMatches={()=>{setMatchPop(null);setTab("matches");}}/>}

      {/* Nuevo aviso modal */}
      {(showNuevo||avisoEditar)&&<NuevoAvisoModal userData={userData} authToken={authData?.token} esEmpresa={esEmpresa}
        avisoEditar={avisoEditar}
        onPublicar={nuevo=>{
          if(avisoEditar) setObras(prev=>prev.map(o=>o.id===nuevo.id?nuevo:o));
          else setObras(prev=>[...prev,nuevo]);
          setDbJobs(prev=>prev.filter(o=>o.id!==nuevo.id));
          toast_(avisoEditar?"Aviso actualizado":"Aviso publicado");
        }}
        onClose={()=>{setShowNuevo(false);setAvisoEditar(null);}}/>}

      {/* HEADER */}
      <div style={{background:"#1a1a2e",color:"#fff",padding:"13px 20px 11px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div>
          <div style={{fontWeight:800,fontSize:20,letterSpacing:-.5}}>S<span style={{color:"#F4A261"}}>afy</span></div>
          <div style={{fontSize:10,color:"#aaa",marginTop:1}}>{esEmpresa?"Panel empresa · "+(userData.empresa||""):"Match SyH · v7 + Supabase"}</div>
        </div>
        {tab==="swipe"&&!esEmpresa?(
          <div style={{background:"rgba(255,255,255,0.15)",borderRadius:99,display:"flex",padding:3}}>
            {[["profesional","Profesionales"],["obras","Empresas"]].map(([v,l])=>(
              <button key={v} onClick={()=>{setVista(v);setIdx(0);}} style={{background:vista===v?"#F4A261":"transparent",color:vista===v?"#1a1a2e":"#fff",border:"none",borderRadius:99,padding:"5px 12px",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>
        ):tab==="mis_busquedas"&&esEmpresa?(
          <button onClick={()=>setShowNuevo(true)} style={{background:"#F4A261",border:"none",borderRadius:99,padding:"7px 14px",color:"#1a1a2e",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>+ Nuevo aviso</button>
        ):(
          <button onClick={onLogout} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:99,padding:"7px 13px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Salir</button>
        )}
      </div>

      {/* CONTENIDO */}
      <div style={{flex:1,padding:"16px 16px 80px",overflowY:"auto"}}>

        {/* SWIPE */}
        {tab==="swipe"&&!esEmpresa&&(
          <div>
            {showFiltros&&(
              <div style={{background:"#fff",borderRadius:16,padding:16,marginBottom:14,boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}>
                <div style={{fontWeight:700,fontSize:14,color:"#1a1a2e",marginBottom:12}}>Filtrar</div>
                <Inp label="Skill / Sector" placeholder="Ej: Altura, NFPA..." value={filtros.sector} onChange={v=>setFiltros(f=>({...f,sector:v}))}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#1a1a2e"}}>Solo disponibles ahora</div>
                  <button onClick={()=>setFiltros(f=>({...f,disponible:!f.disponible}))} style={{width:44,height:26,borderRadius:99,border:"none",background:filtros.disponible?"#2A9D8F":"#e0e0ef",cursor:"pointer",position:"relative",fontFamily:"inherit",flexShrink:0}}>
                    <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:4,left:filtros.disponible?22:4,transition:"left .2s"}}/>
                  </button>
                </div>
                <button onClick={()=>{setFiltros({sector:"",disponible:false});setShowFiltros(false);}} style={{fontSize:12,color:"#aaa",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Limpiar filtros</button>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:13,color:"#888"}}>{vista==="profesional"?"Profesionales":"Empresas"} · {remaining.length} restantes</div>
              <button onClick={()=>setShowFiltros(f=>!f)} style={{background:showFiltros?"#1a1a2e":"#fff",border:"1.5px solid #e0e0ef",borderRadius:99,padding:"5px 12px",fontSize:12,fontWeight:600,color:showFiltros?"#fff":"#1a1a2e",cursor:"pointer",fontFamily:"inherit"}}>
                {showFiltros?"Cerrar":"Filtros"}
              </button>
            </div>
            {remaining.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:10}}>✓</div>
                <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:8}}>Viste todos los perfiles</div>
                <button onClick={()=>setIdx(0)} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:99,padding:"12px 28px",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Recargar</button>
              </div>
            ):(
              <>
                <div style={{position:"relative",height:520,marginBottom:20}}>
                  {remaining.slice(0,3).map((item,i)=>(
                    <div key={item.id} style={{position:"absolute",width:"100%",zIndex:3-i,transform:i>0?("scale("+(1-i*.04)+") translateY("+(i*12)+"px)"):"none",transformOrigin:"top center"}}>
                      <SwipeCard item={item} type={vista==="profesional"?"profesional":"obra"} onSwipe={swipe} isTop={i===0}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"center",gap:20}}>
                  <button onClick={()=>swipe("no")} style={{width:60,height:60,borderRadius:"50%",border:"2px solid #E63946",background:"#fff",color:"#E63946",fontSize:22,cursor:"pointer",boxShadow:"0 4px 12px rgba(230,57,70,.2)",fontFamily:"inherit"}}>✕</button>
                  <button onClick={()=>swipe("yes")} style={{width:60,height:60,borderRadius:"50%",border:"2px solid #2A9D8F",background:"#fff",color:"#2A9D8F",fontSize:22,cursor:"pointer",boxShadow:"0 4px 12px rgba(42,157,143,.2)",fontFamily:"inherit"}}>✓</button>
                </div>
                <div style={{textAlign:"center",color:"#bbb",fontSize:12,marginTop:12}}>Deslizá o usá los botones</div>
              </>
            )}
          </div>
        )}

        {/* OPORTUNIDADES */}
        {tab==="feed"&&!esEmpresa&&(
          <div>
            {loadingJobs&&<div style={{textAlign:"center",padding:"32px 20px",color:"#888",fontSize:13}}>Cargando oportunidades...</div>}
            {!loadingJobs&&todasLasObras.filter(o=>!posts.includes(o.id)).map(obra=>(
              <FeedItem key={obra.id} obra={obra} yaPostulado={posts.includes(obra.id)}
                onPostular={ob=>{setPosts(p=>[...p,ob.id]);toast_("Postulación enviada a "+ob.empresa);}}/>
            ))}
            {!loadingJobs&&todasLasObras.filter(o=>!posts.includes(o.id)).length===0&&(
              <div style={{textAlign:"center",padding:"60px 20px",color:"#999"}}>
                <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                <div style={{fontWeight:700,fontSize:16}}>¡Revisaste todas las oportunidades!</div>
                <div style={{fontSize:13,marginTop:8}}>Volvé más tarde para ver nuevas búsquedas.</div>
              </div>
            )}
          </div>
        )}

        {/* MIS BÚSQUEDAS (empresa) */}
        {tab==="mis_busquedas"&&esEmpresa&&(
          <div>
            {loadingJobs&&<div style={{textAlign:"center",padding:"32px",color:"#888"}}>Cargando avisos...</div>}
            {!loadingJobs&&misObras.length===0&&(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:8}}>Sin avisos publicados</div>
                <div style={{fontSize:13,color:"#888",marginBottom:20}}>Publicá tu primera búsqueda para encontrar profesionales</div>
                <button onClick={()=>setShowNuevo(true)} style={{background:"#F4A261",border:"none",borderRadius:99,padding:"12px 24px",fontWeight:800,fontSize:14,color:"#1a1a2e",cursor:"pointer",fontFamily:"inherit"}}>+ Publicar primer aviso</button>
              </div>
            )}
            {!loadingJobs&&misObras.map(obra=>(
              <div key={obra.id} style={{background:"#fff",borderRadius:16,padding:16,marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:8}}>
                  <Av init={obra.avatar} color={obra.color||"#2A9D8F"} size={44}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e"}}>{obra.empresa}</div>
                    <div style={{fontSize:12,color:"#888"}}>{obra.tipo} · {obra.ciudad}</div>
                  </div>
                  <span style={{background:obra.urgente?"#fdecea":"#f0f0f8",color:obra.urgente?"#E63946":"#888",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>
                    {obra.urgente?"URGENTE":obra.estado||"activa"}
                  </span>
                </div>
                <p style={{fontSize:13,color:"#555",lineHeight:1.45,margin:"0 0 12px"}}>{obra.descripcion}</p>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setAvisoEditar(obra)} style={{flex:1,padding:"9px",borderRadius:12,background:"#f0f0f8",color:"#1a1a2e",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                  <button onClick={()=>{setObras(p=>p.filter(o=>o.id!==obra.id));setDbJobs(p=>p.filter(o=>o.id!==obra.id));toast_("Aviso eliminado","#E63946");}} style={{padding:"9px 14px",borderRadius:12,background:"#fdecea",color:"#E63946",border:"none",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONEXIONES */}
        {tab==="matches"&&(
          <div>
            <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:16}}>Tus conexiones ({matches.length})</div>
            {matches.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>🤝</div>
                <div style={{fontWeight:700,fontSize:16,color:"#1a1a2e",marginBottom:8}}>Aún no tenés conexiones</div>
                <div style={{fontSize:13,color:"#888"}}>Cuando haya un match mutuo, aparecerá aquí con los datos de contacto.</div>
              </div>
            ):(
              matches.map((m,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:16,padding:16,marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                    <Av init={m.avatar||(m.nombre?m.nombre[0]:"?")} color={m.color||"#2A9D8F"} size={48}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:"#1a1a2e"}}>{m.nombre||m.empresa}</div>
                      <div style={{fontSize:12,color:"#888"}}>{TITULOS[m.titulo]||m.tipo||""}{m.ciudad?" · "+m.ciudad:""}</div>
                    </div>
                    <span style={{background:"#e8f7f5",color:"#2A9D8F",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>Match ✓</span>
                  </div>
                  <div style={{background:"#f8f8fc",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{fontSize:12,color:"#888",fontWeight:600,marginBottom:6}}>Contacto</div>
                    <div style={{fontSize:13,color:"#1a73e8",fontWeight:600,marginBottom:2}}>{m.email||"—"}</div>
                    <div style={{fontSize:13,color:"#1a1a2e"}}>{m.tel||"—"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PERFIL */}
        {tab==="perfil"&&(
          <div>
            <div style={{background:"#fff",borderRadius:16,padding:20,marginBottom:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
                <Av init={uInit} color="#1a1a2e" size={64} foto={userData.foto}/>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:"#1a1a2e"}}>{userData.nombre?" "+userData.nombre+" "+(userData.apellido||""):userData.empresa||"Mi perfil"}</div>
                  <div style={{fontSize:12,color:"#888"}}>{TITULOS[userData.titulo]||userData.titulo||""}</div>
                  <div style={{fontSize:12,color:"#aaa"}}>{[userData.ciudad,userData.provincia,PAISES.find(p=>p.v===userData.pais)?.l].filter(Boolean).join(", ")||"Sin ubicación"}</div>
                </div>
              </div>
              {userData.descripcion&&<p style={{fontSize:13,color:"#555",lineHeight:1.5,margin:"0 0 12px"}}>{userData.descripcion}</p>}
              {userData.skills?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{userData.skills.slice(0,6).map((s,i)=><Chip key={i}>{s}</Chip>)}</div>}
              {userData.tarifa&&<div style={{fontSize:13,color:"#1a1a2e",fontWeight:700}}>{userData.moneda==="USD"?"U$D":"$"}{userData.tarifa}/h</div>}
            </div>
            {/* Info de cuenta Supabase */}
            <div style={{background:"#fffbf3",borderRadius:14,padding:"14px 16px",marginBottom:14,border:"1.5px solid #F4A261"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#c97e1a",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>🔐 Cuenta Supabase activa</div>
              <div style={{fontSize:13,color:"#555"}}>{authData?.email||userData.email||"—"}</div>
              <div style={{fontSize:11,color:"#aaa",marginTop:4}}>Tu perfil está guardado en la base de datos</div>
            </div>
            {/* Admin */}
            <div style={{textAlign:"center",marginTop:8}}>
              <details style={{display:"inline-block"}}>
                <summary style={{fontSize:10,color:"rgba(85,102,119,0.4)",cursor:"pointer",listStyle:"none",userSelect:"none"}}>· · ·</summary>
                <div style={{marginTop:8,display:"flex",gap:8,justifyContent:"center"}}>
                  <input value={adminInput} onChange={e=>setAdminInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&tryAdmin()} type="password" placeholder="Admin"
                    style={{padding:"7px 12px",borderRadius:10,border:adminErr?"1.5px solid #E63946":"1.5px solid rgba(85,102,119,0.3)",fontSize:12,outline:"none",width:100,background:"rgba(26,26,46,0.05)",color:"#1a1a2e"}}/>
                  <button onClick={tryAdmin} style={{padding:"7px 12px",borderRadius:10,background:"#F4A261",color:"#1a1a2e",border:"none",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>OK</button>
                </div>
                {adminErr&&<div style={{fontSize:11,color:"#E63946",marginTop:4}}>Incorrecto</div>}
                {adminOpen&&<div style={{fontSize:11,color:"#2A9D8F",marginTop:4,fontWeight:600}}>✓ Acceso admin activado</div>}
              </details>
            </div>
            <button onClick={onLogout} style={{width:"100%",marginTop:20,padding:14,borderRadius:14,border:"1.5px solid #e0e0ef",background:"#fff",color:"#888",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cerrar sesión</button>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:420,background:"#fff",borderTop:"1px solid #f0f0f0",display:"flex",zIndex:50}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
            <span style={{fontSize:20}}>{t.e}</span>
            <span style={{fontSize:10,fontWeight:tab===t.id?800:500,color:tab===t.id?"#1a1a2e":"#aaa"}}>{t.l}</span>
            {tab===t.id&&<div style={{width:16,height:3,borderRadius:99,background:"#F4A261"}}/>}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function Safy() {
  const [phase,setPhase] = useState("splash");
  const [authData,setAuthData] = useState(null); // { token, user, email }
  const [userRol,setUserRol] = useState(null);
  const [userData,setUserData] = useState({});

  if(phase==="splash"||phase==="welcome_in") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#1a1a2e",minHeight:"100vh",maxWidth:420,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <WelcomeScreen onEntrar={()=>setPhase("login")} onRegistrarse={()=>setPhase("registro")} visible={phase==="welcome_in"}/>
      {phase==="splash"&&<SplashScreen onDone={()=>setPhase("welcome_in")}/>}
    </div>
  );

  if(phase==="welcome") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#1a1a2e",minHeight:"100vh",maxWidth:420,margin:"0 auto",overflow:"hidden"}}>
      <style>{CSS}</style>
      <WelcomeScreen onEntrar={()=>setPhase("login")} onRegistrarse={()=>setPhase("registro")} visible={true}/>
    </div>
  );

  if(phase==="login") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto"}}>
      <style>{CSS}</style>
      <div style={{padding:"16px 20px 0",background:"#fff",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setPhase("welcome")} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",padding:0,fontFamily:"inherit"}}>‹</button>
        <span style={{fontWeight:800,fontSize:18,color:"#1a1a2e",letterSpacing:-.5}}>S<span style={{color:"#F4A261"}}>afy</span></span>
      </div>
      <LoginScreen onLogin={(auth)=>{setAuthData(auth);setPhase("onboarding");}} isRegistro={false}/>
    </div>
  );

  if(phase==="registro") return (
    <div style={{fontFamily:"'DM Sans','Inter',system-ui",background:"#f0f0f8",minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:420,margin:"0 auto"}}>
      <style>{CSS}</style>
      <div style={{padding:"16px 20px 0",background:"#fff",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>setPhase("welcome")} style={{background:"none",border:"none",color:"#888",fontSize:22,cursor:"pointer",padding:0,fontFamily:"inherit"}}>‹</button>
        <span style={{fontWeight:800,fontSize:18,color:"#1a1a2e",letterSpacing:-.5}}>S<span style={{color:"#F4A261"}}>afy</span></span>
      </div>
      <LoginScreen onLogin={(auth)=>{setAuthData(auth);setPhase("onboarding");}} isRegistro={true}/>
    </div>
  );

  if(phase==="onboarding") return (
    <Onboarding authData={authData} onComplete={(rol,data)=>{
      setUserRol(rol);
      setUserData({...data, email: authData?.email||data.email});
      setPhase("app");
    }}/>
  );

  return (
    <MainApp userRol={userRol} userData={userData} authData={authData}
      onLogout={()=>{
        setPhase("welcome");
        setUserRol(null);
        setUserData({});
        setAuthData(null);
      }}/>
  );
}
