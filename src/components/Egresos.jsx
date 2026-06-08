// src/components/Egresos.jsx
// Módulo completo de Registro y Control de Egresos — ATM

import { useState, useEffect } from 'react'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const fmtM = n => '$' + fmt(n)
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const mes1 = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01' }

// Grupos de egreso con nombres y colores
const GRUPOS = {
  1:  { nombre:'Arriendos',          icon:'🏪', color:'#1565c0' },
  2:  { nombre:'Cafetería / Aseo',   icon:'☕', color:'#6a1b9a' },
  3:  { nombre:'Asesorías',          icon:'💼', color:'#0277bd' },
  4:  { nombre:'Bienestar Equipo',   icon:'🎉', color:'#2e7d32' },
  5:  { nombre:'Caja Menor',         icon:'💰', color:'#e65100' },
  6:  { nombre:'Herramientas TI',    icon:'💻', color:'#00695c' },
  7:  { nombre:'Equipos / Activos',  icon:'📱', color:'#4527a0' },
  8:  { nombre:'Comisiones',         icon:'🤝', color:'#c62828' },
  10: { nombre:'Impuestos',          icon:'🏛️', color:'#37474f' },
  12: { nombre:'Mantenimientos',     icon:'🔧', color:'#558b2f' },
  14: { nombre:'Nómina',             icon:'👥', color:'#1a3a6b' },
  17: { nombre:'Publicidad',         icon:'📣', color:'#f57f17' },
  18: { nombre:'Seguros / Vehículo', icon:'🚗', color:'#4e342e' },
  20: { nombre:'Transporte',         icon:'🚛', color:'#455a64' },
  21: { nombre:'Bodegas',            icon:'📦', color:'#6d4c41' },
  22: { nombre:'Dotación',           icon:'👕', color:'#ad1457' },
  23: { nombre:'Tecnología',         icon:'📡', color:'#00838f' },
  25: { nombre:'Gastos Hogar',       icon:'🏠', color:'#5d4037' },
}

const MEDIO_PAGO = ['EFECTIVO','TRANSFERENCIA','CONSIGNACIÓN']

export default function Egresos({ supabase, usuario, onClose }) {
  const [tab,          setTab]          = useState('registrar')  // registrar | consultar | resumen
  const [subdetalles,  setSubdetalles]  = useState([])
  const [terceros,     setTerceros]     = useState([])
  const [egresos,      setEgresos]      = useState([])
  const [cargando,     setCargando]     = useState(false)
  const [guardando,    setGuardando]    = useState(false)
  const [msg,          setMsg]          = useState(null)
  // CRUD Tipos de egreso
  const [showTipos,    setShowTipos]    = useState(false)
  const [nuevoTipo,    setNuevoTipo]    = useState('')
  const [guardandoT,   setGuardandoT]  = useState(false)
  // CRUD Terceros
  const [showTerc,     setShowTerc]     = useState(false)
  const [formTerc,     setFormTerc]     = useState({cedrif:'',nombre:'',ciudad:'',telefono:'',celular:''})
  const [guardandoTer, setGuardandoTer] = useState(false)
  const [editTerc,     setEditTerc]     = useState(null)
  const [filtTerc,     setFiltTerc]     = useState('')

  // Filtros consulta
  const [filtDesde,    setFiltDesde]    = useState(mes1())
  const [filtHasta,    setFiltHasta]    = useState(hoy())
  const [filtGrupo,    setFiltGrupo]    = useState('')
  const [filtMedio,    setFiltMedio]    = useState('')

  // Formulario nuevo egreso
  const [form, setForm] = useState({
    tipoegreso: '',
    codegreso:  '',
    fechapag:   hoy(),
    cedrifben:  '',
    nomrazben:  '',
    subdetalle: '',
    perdesde:   '',
    perhasta:   '',
    valorneto:  '',
    valrecarg:  '0',
    valdescue:  '0',
    mediopago:  'EFECTIVO',
    observacio: '',
  })

  // Subdetalles filtrados por grupo seleccionado
  const subsFiltrados = subdetalles.filter(s => String(s.tipoegreso) === String(form.tipoegreso))

  useEffect(() => {
    cargarMaestros()
  }, [])

  async function cargarMaestros() {
    const [{data:subs}, {data:terc}] = await Promise.all([
      supabase.from('egr_grupos').select('id,nombre,cg').order('nombre'),
      supabase.from('terceros').select('cedrif,nombre,ciudad,telefono,celular').eq('activo', true).order('nombre'),
    ])
    setSubdetalles(subs||[])
    setTerceros(terc||[])
  }

  async function consultar() {
    setCargando(true)
    let q = supabase.from('egresos')
      .select('*')
      .gte('fechapag', filtDesde)
      .lte('fechapag', filtHasta)
      .order('fechapag', {ascending:false})
    if (filtGrupo) q = q.eq('grupo_id', Number(filtGrupo))
    if (filtMedio) q = q.eq('medio_pago', filtMedio)
    const {data, error} = await q.limit(2000)
    if (error) console.error(error)
    setEgresos(data||[])
    setCargando(false)
  }

  function setF(k, v) {
    setForm(prev => {
      const nuevo = {...prev, [k]:v}
      // Al cambiar grupo, limpiar subdetalle
      if (k === 'tipoegreso') nuevo.codegreso = ''
      // Al cambiar subdetalle, autocompletar descegreso
      if (k === 'codegreso') {
        const sub = subdetalles.find(s => String(s.tipoegreso)===String(nuevo.tipoegreso) && String(s.codegreso)===String(v))
        if (sub) nuevo.descegreso = sub.descegreso
      }
      // Al cambiar cédula beneficiario, buscar nombre
      if (k === 'cedrifben') {
        const terc = terceros.find(t => String(t.cedrif) === String(v))
        if (terc) nuevo.nomrazben = terc.nomtercero
      }
      return nuevo
    })
  }

  const valtotal = () => {
    const n = Number(form.valorneto||0)
    const r = Number(form.valrecarg||0)
    const d = Number(form.valdescue||0)
    return n + r - d
  }

  async function guardar() {
    setMsg(null)
    if (!form.tipoegreso)  return setMsg({ok:false, txt:'Selecciona el grupo de egreso.'})
    if (!form.fechapag)    return setMsg({ok:false, txt:'Ingresa la fecha de pago.'})
    if (!form.nomrazben)   return setMsg({ok:false, txt:'Ingresa el beneficiario.'})
    if (!form.valorneto || Number(form.valorneto) <= 0)
                           return setMsg({ok:false, txt:'Ingresa un valor válido.'})
    setGuardando(true)
    const sub = subdetalles.find(s => String(s.tipoegreso)===String(form.tipoegreso) && String(s.codegreso)===String(form.codegreso))
    const registro = {
      grupo_id: Number(form.tipoegreso),
      tipo_id:  Number(form.codegreso),
      descegreso: sub?.descegreso || '',
      tipocod:    sub?.tipocod || null,
      fecha_pago: form.fechapag,
      cedrif_benef: form.cedrifben || null,
      nombre_benef: form.nomrazben,
      subdetalle: form.subdetalle || null,
      per_desde:   form.perdesde || null,
      per_hasta:   form.perhasta || null,
      subtotal:    Number(form.valorneto),
      recargos:    Number(form.valrecarg||0),
      descuento:   Number(form.valdescue||0),
      total:       valtotal(),
      medio_pago:  form.mediopago,
      observaciones: form.observacio || null,
      usuario:    usuario?.usuario || 'admin',
      fecregistr: new Date().toISOString(),
    }
    const {error} = await supabase.from('egresos').insert(registro)
    if (error) {
      setMsg({ok:false, txt:'Error al guardar: ' + error.message})
    } else {
      setMsg({ok:true, txt:`✅ Egreso registrado correctamente — $${fmt(valtotal())}`})
      setForm({
        tipoegreso:'', codegreso:'', fechapag:hoy(), cedrifben:'', nomrazben:'',
        subdetalle:'', perdesde:'', perhasta:'', valorneto:'', valrecarg:'0',
        valdescue:'0', mediopago:'EFECTIVO', observacio:'',
      })
    }
    setGuardando(false)
  }

  // Resumen por grupo
  const resumenGrupos = () => {
    const map = {}
    egresos.forEach(e => {
      const k = e.grupo_id
      if (!map[k]) map[k] = { tipoegreso:k, total:0, count:0 }
      map[k].total += e.total||0
      map[k].count++
    })
    return Object.values(map).sort((a,b) => b.total-a.total)
  }

  const totalEgresos = egresos.reduce((s,e) => s+(e.total||0), 0)
  const totalEfect   = egresos.filter(e=>e.medio_pago==='EFECTIVO').reduce((s,e)=>s+(e.total||0),0)
  const totalTransf  = egresos.filter(e=>e.medio_pago==='TRANSFERENCIA').reduce((s,e)=>s+(e.total||0),0)

  function imprimirEgresos() {
    const w = window.open('','_blank','width=1000,height=700')
    const grupos_res = resumenGrupos()
    w.document.write(`<html><head><title>Egresos</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:20px;}
      h2{color:#1a3a6b;text-align:center;}
      .sub{text-align:center;color:#555;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;}
      th{background:#1a3a6b;color:#fff;padding:5px 8px;text-align:right;font-size:10px;}
      th:first-child{text-align:left;}
      td{padding:4px 8px;border-bottom:1px solid #eee;text-align:right;font-size:11px;}
      td:first-child{text-align:left;}
      tr:nth-child(even){background:#f9f9f9;}
      .tot{font-weight:900;background:#dde3ee!important;}
      .sec{background:#e8eaf6;font-weight:700;padding:4px 8px;margin-top:12px;}
      @media print{button{display:none}}
    </style></head><body>
    <h2>ATM — REPORTE DE EGRESOS</h2>
    <div class="sub">Período: ${filtDesde} al ${filtHasta} &nbsp;|&nbsp; ${egresos.length} registros &nbsp;|&nbsp; Total: ${fmtM(totalEgresos)}</div>
    <button onclick="window.print()" style="margin-bottom:14px;padding:6px 18px;background:#1a3a6b;color:#fff;border:none;border-radius:4px;cursor:pointer;">🖨 Imprimir</button>

    <div class="sec">RESUMEN POR CATEGORÍA</div>
    <table><thead><tr><th>Categoría</th><th>Registros</th><th>Total</th></tr></thead><tbody>
    ${grupos_res.map(g=>`<tr><td>${GRUPOS[g.tipoegreso]?.icon||''} ${GRUPOS[g.tipoegreso]?.nombre||'Grupo '+g.tipoegreso}</td><td>${g.count}</td><td>${fmtM(g.total)}</td></tr>`).join('')}
    <tr class="tot"><td>TOTALES</td><td>${egresos.length}</td><td>${fmtM(totalEgresos)}</td></tr>
    </tbody></table>

    <div class="sec">DETALLE DE EGRESOS</div>
    <table><thead><tr>
      <th style="text-align:left">Fecha</th>
      <th style="text-align:left">Categoría</th>
      <th style="text-align:left">Tipo</th>
      <th style="text-align:left">Beneficiario</th>
      <th>Valor Neto</th><th>Total</th><th>Medio</th>
    </tr></thead><tbody>
    ${egresos.map(e=>`<tr>
      <td style="text-align:left">${e.fecha_pago||''}</td>
      <td style="text-align:left">${GRUPOS[e.grupo_id]?.nombre||e.grupo_id}</td>
      <td style="text-align:left">${e.descegreso||''}</td>
      <td style="text-align:left">${e.nombre_benef||''}</td>
      <td>${fmtM(e.subtotal)}</td>
      <td style="font-weight:700">${fmtM(e.total)}</td>
      <td>${e.medio_pago||''}</td>
    </tr>`).join('')}
    <tr class="tot"><td colspan="4">TOTALES</td><td>${fmtM(egresos.reduce((s,e)=>s+(e.subtotal||0),0))}</td><td>${fmtM(totalEgresos)}</td><td></td></tr>
    </tbody></table>
    </body></html>`)
    w.document.close()
  }

  // ── CRUD TIPOS DE EGRESO ─────────────────────────────────────────────────
  async function agregarTipo() {
    if (!nuevoTipo.trim()) return
    setGuardandoT(true)
    await supabase.from('egr_grupos').insert({nombre: nuevoTipo.trim(), cg: 0})
    setNuevoTipo('')
    await cargarMaestros()
    setGuardandoT(false)
  }
  async function eliminarTipo(id) {
    if (!window.confirm('¿Eliminar este tipo de egreso?')) return
    await supabase.from('egr_grupos').delete().eq('id', id)
    await cargarMaestros()
  }

  // ── CRUD TERCEROS ─────────────────────────────────────────────────────────
  async function guardarTercero() {
    if (!formTerc.cedrif || !formTerc.nombre) return
    setGuardandoTer(true)
    if (editTerc) {
      await supabase.from('terceros').update({
        nombre: formTerc.nombre, ciudad: formTerc.ciudad,
        telefono: formTerc.telefono, celular: formTerc.celular
      }).eq('cedrif', editTerc)
    } else {
      await supabase.from('terceros').insert({
        cedrif: formTerc.cedrif, nombre: formTerc.nombre,
        ciudad: formTerc.ciudad, telefono: formTerc.telefono,
        celular: formTerc.celular, activo: 1
      })
    }
    setFormTerc({cedrif:'',nombre:'',ciudad:'',telefono:'',celular:''})
    setEditTerc(null)
    const {data} = await supabase.from('terceros').select('cedrif,nombre').eq('activo',1).order('nombre')
    setTerceros(data||[])
    setGuardandoTer(false)
  }
  async function eliminarTercero(cedrif) {
    if (!window.confirm('¿Eliminar este tercero?')) return
    await supabase.from('terceros').update({activo:0}).eq('cedrif', cedrif)
    const {data} = await supabase.from('terceros').select('cedrif,nombre').eq('activo',1).order('nombre')
    setTerceros(data||[])
  }
  function editarTercero(t) {
    setFormTerc({cedrif:t.cedrif, nombre:t.nombre||'', ciudad:t.ciudad||'', telefono:t.telefono||'', celular:t.celular||''})
    setEditTerc(t.cedrif)
    setShowTerc(true)
  }

  return (
    <div style={E.pagina}>
      <div style={E.ventana}>

        {/* HEADER */}
        <div style={E.header}>
          <div style={{display:'flex',flexDirection:'column',lineHeight:1.1}}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.7)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={E.headerTit}>CONTROL DE EGRESOS</span>
          <button onClick={onClose} style={E.btnCerrar}>← Menú</button>
        </div>

        {/* GESTIÓN MAESTROS */}
        <div style={{display:'flex',gap:8,padding:'6px 14px',background:'#f0f4ff',borderBottom:'1px solid #c8d5ea'}}>
          <button onClick={()=>setShowTipos(!showTipos)}
            style={{fontSize:11,padding:'3px 12px',border:'1px solid #c8d5ea',borderRadius:4,background:showTipos?'#1a3a6b':'#fff',color:showTipos?'#fff':'#1a3a6b',cursor:'pointer',fontWeight:600}}>
            ⚙️ Gestionar Tipos de Egreso
          </button>
          <button onClick={()=>setShowTerc(!showTerc)}
            style={{fontSize:11,padding:'3px 12px',border:'1px solid #c8d5ea',borderRadius:4,background:showTerc?'#1a3a6b':'#fff',color:showTerc?'#fff':'#1a3a6b',cursor:'pointer',fontWeight:600}}>
            👥 Gestionar Terceros
          </button>
        </div>

        {/* PANEL TIPOS DE EGRESO */}
        {showTipos && (
          <div style={{background:'#fff',borderBottom:'1px solid #dde3ee',padding:'12px 16px'}}>
            <div style={{fontWeight:700,fontSize:13,color:'#1a3a6b',marginBottom:8}}>⚙️ Tipos de Egreso</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <input style={{...E.inp,width:280}} value={nuevoTipo} onChange={e=>setNuevoTipo(e.target.value)}
                placeholder="Nuevo tipo de egreso..." onKeyDown={e=>e.key==='Enter'&&agregarTipo()}/>
              <button onClick={agregarTipo} disabled={guardandoT} style={{...E.btnGenerar,height:32}}>
                {guardandoT?'⏳':'➕'} Agregar
              </button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {subdetalles.map(g=>(
                <div key={g.id} style={{display:'flex',alignItems:'center',gap:4,background:'#eef2ff',borderRadius:16,padding:'3px 10px',fontSize:12}}>
                  <span>{g.nombre}</span>
                  <button onClick={()=>eliminarTipo(g.id)}
                    style={{background:'none',border:'none',color:'#c62828',cursor:'pointer',fontSize:13,padding:'0 2px',lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL TERCEROS */}
        {showTerc && (
          <div style={{background:'#fff',borderBottom:'1px solid #dde3ee',padding:'12px 16px'}}>
            <div style={{fontWeight:700,fontSize:13,color:'#1a3a6b',marginBottom:8}}>👥 Gestionar Terceros</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 1fr 1fr auto',gap:6,marginBottom:10,alignItems:'end'}}>
              <div><label style={E.lbl}>Cédula/NIT</label>
                <input style={E.inp} value={formTerc.cedrif} onChange={e=>setFormTerc(p=>({...p,cedrif:e.target.value}))}
                  placeholder="Cédula/NIT" disabled={!!editTerc}/></div>
              <div><label style={E.lbl}>Nombre *</label>
                <input style={E.inp} value={formTerc.nombre} onChange={e=>setFormTerc(p=>({...p,nombre:e.target.value}))}
                  placeholder="Nombre completo"/></div>
              <div><label style={E.lbl}>Ciudad</label>
                <input style={E.inp} value={formTerc.ciudad} onChange={e=>setFormTerc(p=>({...p,ciudad:e.target.value}))}
                  placeholder="Ciudad"/></div>
              <div><label style={E.lbl}>Teléfono</label>
                <input style={E.inp} value={formTerc.telefono} onChange={e=>setFormTerc(p=>({...p,telefono:e.target.value}))}
                  placeholder="Teléfono"/></div>
              <div><label style={E.lbl}>Celular</label>
                <input style={E.inp} value={formTerc.celular} onChange={e=>setFormTerc(p=>({...p,celular:e.target.value}))}
                  placeholder="Celular"/></div>
              <div style={{display:'flex',gap:4}}>
                <button onClick={guardarTercero} disabled={guardandoTer}
                  style={{...E.btnGenerar,height:32,whiteSpace:'nowrap'}}>
                  {guardandoTer?'⏳':editTerc?'💾 Guardar':'➕ Agregar'}
                </button>
                {editTerc && <button onClick={()=>{setEditTerc(null);setFormTerc({cedrif:'',nombre:'',ciudad:'',telefono:'',celular:''})}}
                  style={{...E.btnLimpiar,height:32}}>✕</button>}
              </div>
            </div>
            <div style={{maxHeight:180,overflowY:'auto'}}>
              <table style={{...E.tabla,fontSize:11}}>
                <thead><tr style={E.thead}>
                  {['Cédula/NIT','Nombre','Ciudad','Teléfono','Celular',''].map(h=>(
                    <th key={h} style={E.th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {terceros.map((t,i)=>(
                    <tr key={t.cedrif} style={{background:i%2===0?'#fff':'#f8faff'}}>
                      <td style={E.td}>{t.cedrif}</td>
                      <td style={{...E.td,fontWeight:600}}>{t.nombre}</td>
                      <td style={E.td}>{t.ciudad||''}</td>
                      <td style={E.td}>{t.telefono||''}</td>
                      <td style={E.td}>{t.celular||''}</td>
                      <td style={E.td}>
                        <button onClick={()=>editarTercero(t)}
                          style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,marginRight:4}}>✏️</button>
                        <button onClick={()=>eliminarTercero(t.cedrif)}
                          style={{background:'#fdecea',border:'1px solid #ef9a9a',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#c62828'}}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TABS PRINCIPALES */}
        <div style={E.tabs}>
          {[
            {id:'registrar', label:'➕ Registrar Egreso'},
            {id:'consultar', label:'🔍 Consultar / Imprimir'},
            {id:'resumen',   label:'📊 Resumen por Categoría'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{...E.tab,...(tab===t.id?E.tabActivo:{})}}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={E.contenido}>

          {/* ── REGISTRAR ── */}
          {tab==='registrar' && (
            <div style={E.card}>
              <div style={E.cardTit}>📝 Nuevo Egreso</div>

              <div style={E.grid2}>
                {/* 1. Tipo de Egreso */}
                <div style={E.campo}>
                  <label style={E.lbl}>Tipo de Egreso *</label>
                  <select style={E.sel} value={form.tipoegreso} onChange={e=>setF('tipoegreso',e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {subdetalles.map(g=>(
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Subdetalle */}
                <div style={E.campo}>
                  <label style={E.lbl}>Subdetalle / Descripción</label>
                  <input style={E.inp} value={form.subdetalle} onChange={e=>setF('subdetalle',e.target.value)}
                    placeholder="Descripción adicional (opcional)"/>
                </div>

                {/* 3. Período - al cambiar desde, calcula hasta automáticamente */}
                <div style={{...E.campo,gridColumn:'span 2'}}>
                  <label style={E.lbl}>Período</label>
                  <div style={{display:'flex',gap:6}}>
                    <input style={{...E.inp,flex:1}} type="date" value={form.perdesde}
                      onChange={e=>{
                        const desde = e.target.value
                        setF('perdesde', desde)
                        if (desde) {
                          const d = new Date(desde)
                          const diasMes = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()
                          d.setDate(d.getDate() + diasMes - 1)
                          const hasta = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
                          setForm(prev=>({...prev, perdesde:desde, perhasta:hasta}))
                        }
                      }} title="Desde"/>
                    <input style={{...E.inp,flex:1}} type="date" value={form.perhasta}
                      onChange={e=>setF('perhasta',e.target.value)} title="Hasta"/>
                  </div>
                </div>

                {/* 4. Fecha de pago */}
                <div style={E.campo}>
                  <label style={E.lbl}>Fecha de Pago *</label>
                  <input style={E.inp} type="date" value={form.fechapag} onChange={e=>setF('fechapag',e.target.value)}/>
                </div>

                {/* 5. Medio de pago */}
                <div style={E.campo}>
                  <label style={E.lbl}>Medio de Pago *</label>
                  <select style={E.sel} value={form.mediopago} onChange={e=>setF('mediopago',e.target.value)}>
                    {MEDIO_PAGO.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* 6. Beneficiario */}
                <div style={E.campo}>
                  <label style={E.lbl}>Cédula / NIT Beneficiario</label>
                  <div style={{position:'relative'}}>
                    <input style={E.inp} value={filtTerc}
                      onChange={e=>setFiltTerc(e.target.value)}
                      placeholder="Buscar por nombre o cédula..."/>
                    {filtTerc.length >= 2 && (
                      <div style={{position:'absolute',top:34,left:0,right:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:5,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',zIndex:100,maxHeight:180,overflowY:'auto'}}>
                        {terceros
                          .filter(t => t.nombre?.toLowerCase().includes(filtTerc.toLowerCase()) || t.cedrif?.includes(filtTerc))
                          .map(t=>(
                            <div key={t.cedrif}
                              onMouseDown={()=>{ setF('cedrifben', t.cedrif); setFiltTerc(t.nombre||t.cedrif) }}
                              style={{padding:'7px 12px',cursor:'pointer',fontSize:12,borderBottom:'1px solid #eee'}}
                              onMouseEnter={e=>e.currentTarget.style.background='#eef2ff'}
                              onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                              <strong>{t.nombre}</strong> <span style={{color:'#888',fontSize:11}}>{t.cedrif}</span>
                            </div>
                          ))
                        }
                        {terceros.filter(t => t.nombre?.toLowerCase().includes(filtTerc.toLowerCase()) || t.cedrif?.includes(filtTerc)).length === 0 && (
                          <div style={{padding:'10px 12px',color:'#aaa',fontSize:12}}>Sin resultados</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 7. Nombre beneficiario */}
                <div style={E.campo}>
                  <label style={E.lbl}>Nombre / Razón Social *</label>
                  <input style={E.inp} value={form.nomrazben} onChange={e=>setF('nomrazben',e.target.value)}
                    placeholder="Nombre del beneficiario"/>
                </div>

                {/* 8. Valor neto */}
                <div style={E.campo}>
                  <label style={E.lbl}>Valor Neto *</label>
                  <input style={{...E.inp,fontWeight:700,fontSize:15}} type="number" min={0}
                    value={form.valorneto} onChange={e=>setF('valorneto',e.target.value)}
                    placeholder="$0"/>
                </div>

                {/* 9. Recargo y descuento */}
                <div style={E.campo}>
                  <label style={E.lbl}>Recargo / Descuento</label>
                  <div style={{display:'flex',gap:6}}>
                    <input style={{...E.inp,flex:1}} type="number" min={0} value={form.valrecarg}
                      onChange={e=>setF('valrecarg',e.target.value)} placeholder="Recargo"/>
                    <input style={{...E.inp,flex:1}} type="number" min={0} value={form.valdescue}
                      onChange={e=>setF('valdescue',e.target.value)} placeholder="Descuento"/>
                  </div>
                </div>
              </div>

              {/* Observación */}
              <div style={{...E.campo,marginTop:4}}>
                <label style={E.lbl}>Observación</label>
                <input style={E.inp} value={form.observacio} onChange={e=>setF('observacio',e.target.value)}
                  placeholder="Observación opcional"/>
              </div>

              {/* Total calculado */}
              {form.valorneto && (
                <div style={E.totalBox}>
                  <span style={{fontSize:13,color:'#555'}}>TOTAL A PAGAR</span>
                  <span style={{fontSize:22,fontWeight:900,color:'#c62828'}}>{fmtM(valtotal())}</span>
                  {form.tipoegreso && (
                    <span style={{fontSize:12,color:GRUPOS[form.tipoegreso]?.color,fontWeight:700}}>
                      {GRUPOS[form.tipoegreso]?.icon} {GRUPOS[form.tipoegreso]?.nombre}
                    </span>
                  )}
                </div>
              )}

              {msg && (
                <div style={{...E.msg, ...(msg.ok?E.msgOk:E.msgErr)}}>{msg.txt}</div>
              )}

              <div style={{display:'flex',gap:10,marginTop:12}}>
                <button onClick={guardar} disabled={guardando} style={E.btnGuardar}>
                  {guardando ? '⏳ Guardando…' : '💾 Guardar Egreso'}
                </button>
                <button onClick={()=>{setForm({tipoegreso:'',codegreso:'',fechapag:hoy(),cedrifben:'',nomrazben:'',subdetalle:'',perdesde:'',perhasta:'',valorneto:'',valrecarg:'0',valdescue:'0',mediopago:'EFECTIVO',observacio:''});setFiltTerc('');setMsg(null)}}
                  style={E.btnLimpiar}>
                  🗑 Limpiar
                </button>
              </div>
            </div>
          )}

          {/* ── CONSULTAR ── */}
          {tab==='consultar' && (
            <div>
              {/* Filtros */}
              <div style={E.filtros}>
                <div style={E.campo}>
                  <label style={E.lbl}>Desde</label>
                  <input style={E.inp} type="date" value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}/>
                </div>
                <div style={E.campo}>
                  <label style={E.lbl}>Hasta</label>
                  <input style={E.inp} type="date" value={filtHasta} onChange={e=>setFiltHasta(e.target.value)}/>
                </div>
                <div style={E.campo}>
                  <label style={E.lbl}>Categoría</label>
                  <select style={E.sel} value={filtGrupo} onChange={e=>setFiltGrupo(e.target.value)}>
                    <option value="">— Todas —</option>
                    {subdetalles.map(g=>(
                      <option key={g.id} value={g.id}>{g.nombre}</option>
                    ))}
                  </select>
                </div>
                <div style={E.campo}>
                  <label style={E.lbl}>Medio de Pago</label>
                  <select style={E.sel} value={filtMedio} onChange={e=>setFiltMedio(e.target.value)}>
                    <option value="">— Todos —</option>
                    {MEDIO_PAGO.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
                  <button onClick={consultar} disabled={cargando} style={E.btnGenerar}>
                    {cargando?'⏳ Cargando…':'🔍 Consultar'}
                  </button>
                  {egresos.length>0 && (
                    <button onClick={imprimirEgresos} style={E.btnPrint}>🖨 Imprimir</button>
                  )}
                </div>
              </div>

              {/* Totales rápidos */}
              {egresos.length>0 && (
                <div style={E.barTotales}>
                  <div style={E.totChip}>
                    <span style={E.totLbl}>Registros</span>
                    <span style={{...E.totVal,color:'#1a3a6b'}}>{egresos.length}</span>
                  </div>
                  <div style={E.totChip}>
                    <span style={E.totLbl}>Efectivo</span>
                    <span style={{...E.totVal,color:'#2e7d32'}}>{fmtM(totalEfect)}</span>
                  </div>
                  <div style={E.totChip}>
                    <span style={E.totLbl}>Transferencia</span>
                    <span style={{...E.totVal,color:'#1565c0'}}>{fmtM(totalTransf)}</span>
                  </div>
                  <div style={E.totChip}>
                    <span style={E.totLbl}>TOTAL EGRESOS</span>
                    <span style={{...E.totVal,fontSize:18,color:'#c62828'}}>{fmtM(totalEgresos)}</span>
                  </div>
                </div>
              )}

              {/* Tabla de egresos */}
              {egresos.length>0 && (
                <div style={{overflowX:'auto'}}>
                  <table style={E.tabla}>
                    <thead>
                      <tr style={E.thead}>
                        {['Fecha','Categoría','Tipo de Egreso','Beneficiario','Período','Valor Neto','Total','Medio','Obs.'].map(h=>(
                          <th key={h} style={{...E.th,textAlign:['Valor Neto','Total'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {egresos.map((e,i)=>{
                        const g = GRUPOS[e.grupo_id]
                        // ── CRUD TIPOS DE EGRESO ─────────────────────────────────────────────────
  async function agregarTipo() {
    if (!nuevoTipo.trim()) return
    setGuardandoT(true)
    await supabase.from('egr_grupos').insert({nombre: nuevoTipo.trim(), cg: 0})
    setNuevoTipo('')
    await cargarMaestros()
    setGuardandoT(false)
  }
  async function eliminarTipo(id) {
    if (!window.confirm('¿Eliminar este tipo de egreso?')) return
    await supabase.from('egr_grupos').delete().eq('id', id)
    await cargarMaestros()
  }

  // ── CRUD TERCEROS ─────────────────────────────────────────────────────────
  async function guardarTercero() {
    if (!formTerc.cedrif || !formTerc.nombre) return
    setGuardandoTer(true)
    if (editTerc) {
      await supabase.from('terceros').update({
        nombre: formTerc.nombre, ciudad: formTerc.ciudad,
        telefono: formTerc.telefono, celular: formTerc.celular
      }).eq('cedrif', editTerc)
    } else {
      await supabase.from('terceros').insert({
        cedrif: formTerc.cedrif, nombre: formTerc.nombre,
        ciudad: formTerc.ciudad, telefono: formTerc.telefono,
        celular: formTerc.celular, activo: 1
      })
    }
    setFormTerc({cedrif:'',nombre:'',ciudad:'',telefono:'',celular:''})
    setEditTerc(null)
    const {data} = await supabase.from('terceros').select('cedrif,nombre').eq('activo',1).order('nombre')
    setTerceros(data||[])
    setGuardandoTer(false)
  }
  async function eliminarTercero(cedrif) {
    if (!window.confirm('¿Eliminar este tercero?')) return
    await supabase.from('terceros').update({activo:0}).eq('cedrif', cedrif)
    const {data} = await supabase.from('terceros').select('cedrif,nombre').eq('activo',1).order('nombre')
    setTerceros(data||[])
  }
  function editarTercero(t) {
    setFormTerc({cedrif:t.cedrif, nombre:t.nombre||'', ciudad:t.ciudad||'', telefono:t.telefono||'', celular:t.celular||''})
    setEditTerc(t.cedrif)
    setShowTerc(true)
  }

  return (
                          <tr key={e.id||i} style={{background:i%2===0?'#fff':'#f8faff'}}>
                            <td style={E.td}>{e.fecha_pago?.slice(0,10)||''}</td>
                            <td style={E.td}>
                              <span style={{background:g?.color||'#888',color:'#fff',padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                                {g?.icon} {g?.nombre||e.grupo_id}
                              </span>
                            </td>
                            <td style={{...E.td,fontSize:11}}>{e.descegreso||''}</td>
                            <td style={{...E.td,fontWeight:600}}>{e.nombre_benef||''}</td>
                            <td style={{...E.td,fontSize:11,color:'#888'}}>
                              {e.per_desde&&e.per_hasta?`${e.per_desde?.slice(0,10)} → ${e.per_hasta?.slice(0,10)}`:''}
                            </td>
                            <td style={{...E.td,textAlign:'right'}}>{fmtM(e.subtotal)}</td>
                            <td style={{...E.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>{fmtM(e.total)}</td>
                            <td style={{...E.td,fontSize:11}}>
                              <span style={{color:e.medio_pago==='EFECTIVO'?'#2e7d32':'#1565c0',fontWeight:600}}>
                                {e.medio_pago==='EFECTIVO'?'💵':'🏦'} {e.medio_pago}
                              </span>
                            </td>
                            <td style={{...E.td,fontSize:11,color:'#888',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                              title={e.observaciones||''}>
                              {e.observaciones||''}
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{background:'#dde3ee',fontWeight:900}}>
                        <td colSpan={5} style={E.td}><strong>TOTALES — {egresos.length} registros</strong></td>
                        <td style={{...E.td,textAlign:'right'}}>{fmtM(egresos.reduce((s,e)=>s+(e.subtotal||0),0))}</td>
                        <td style={{...E.td,textAlign:'right',color:'#c62828',fontSize:14}}>{fmtM(totalEgresos)}</td>
                        <td colSpan={2} style={E.td}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {egresos.length===0 && !cargando && (
                <div style={{textAlign:'center',padding:50,color:'#aab8d4',fontSize:14}}>
                  Selecciona el período y presiona <strong>Consultar</strong>
                </div>
              )}
            </div>
          )}

          {/* ── RESUMEN POR CATEGORÍA ── */}
          {tab==='resumen' && (
            <div>
              <div style={E.filtros}>
                <div style={E.campo}>
                  <label style={E.lbl}>Desde</label>
                  <input style={E.inp} type="date" value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}/>
                </div>
                <div style={E.campo}>
                  <label style={E.lbl}>Hasta</label>
                  <input style={E.inp} type="date" value={filtHasta} onChange={e=>setFiltHasta(e.target.value)}/>
                </div>
                <div style={{display:'flex',alignItems:'flex-end'}}>
                  <button onClick={consultar} disabled={cargando} style={E.btnGenerar}>
                    {cargando?'⏳':'📊'} Generar Resumen
                  </button>
                </div>
              </div>

              {egresos.length>0 && (
                <>
                  {/* Tarjetas por categoría */}
                  <div style={E.gridCards}>
                    {resumenGrupos().map(g=>{
                      const info = GRUPOS[g.tipoegreso]
                      const pct = totalEgresos > 0 ? (g.total/totalEgresos*100).toFixed(1) : 0
                      // ── CRUD TIPOS DE EGRESO ─────────────────────────────────────────────────
  async function agregarTipo() {
    if (!nuevoTipo.trim()) return
    setGuardandoT(true)
    await supabase.from('egr_grupos').insert({nombre: nuevoTipo.trim(), cg: 0})
    setNuevoTipo('')
    await cargarMaestros()
    setGuardandoT(false)
  }
  async function eliminarTipo(id) {
    if (!window.confirm('¿Eliminar este tipo de egreso?')) return
    await supabase.from('egr_grupos').delete().eq('id', id)
    await cargarMaestros()
  }

  // ── CRUD TERCEROS ─────────────────────────────────────────────────────────
  async function guardarTercero() {
    if (!formTerc.cedrif || !formTerc.nombre) return
    setGuardandoTer(true)
    if (editTerc) {
      await supabase.from('terceros').update({
        nombre: formTerc.nombre, ciudad: formTerc.ciudad,
        telefono: formTerc.telefono, celular: formTerc.celular
      }).eq('cedrif', editTerc)
    } else {
      await supabase.from('terceros').insert({
        cedrif: formTerc.cedrif, nombre: formTerc.nombre,
        ciudad: formTerc.ciudad, telefono: formTerc.telefono,
        celular: formTerc.celular, activo: 1
      })
    }
    setFormTerc({cedrif:'',nombre:'',ciudad:'',telefono:'',celular:''})
    setEditTerc(null)
    const {data} = await supabase.from('terceros').select('cedrif,nombre').eq('activo',1).order('nombre')
    setTerceros(data||[])
    setGuardandoTer(false)
  }
  async function eliminarTercero(cedrif) {
    if (!window.confirm('¿Eliminar este tercero?')) return
    await supabase.from('terceros').update({activo:0}).eq('cedrif', cedrif)
    const {data} = await supabase.from('terceros').select('cedrif,nombre').eq('activo',1).order('nombre')
    setTerceros(data||[])
  }
  function editarTercero(t) {
    setFormTerc({cedrif:t.cedrif, nombre:t.nombre||'', ciudad:t.ciudad||'', telefono:t.telefono||'', celular:t.celular||''})
    setEditTerc(t.cedrif)
    setShowTerc(true)
  }

  return (
                        <div key={g.tipoegreso} style={{...E.cardGrupo, borderLeft:`4px solid ${info?.color||'#888'}`}}>
                          <div style={{fontSize:22}}>{info?.icon||'📌'}</div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,color:'#1a3a6b'}}>{info?.nombre||'Grupo '+g.tipoegreso}</div>
                            <div style={{fontSize:11,color:'#888'}}>{g.count} registro{g.count!==1?'s':''} · {pct}%</div>
                          </div>
                          <div style={{fontWeight:900,fontSize:15,color:info?.color||'#888'}}>{fmtM(g.total)}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Barra total */}
                  <div style={{...E.barTotales,marginTop:16,justifyContent:'center'}}>
                    <div style={E.totChip}>
                      <span style={E.totLbl}>TOTAL EGRESOS PERÍODO</span>
                      <span style={{...E.totVal,fontSize:22,color:'#c62828'}}>{fmtM(totalEgresos)}</span>
                    </div>
                    <div style={E.totChip}>
                      <span style={E.totLbl}>Efectivo</span>
                      <span style={{...E.totVal,color:'#2e7d32'}}>{fmtM(totalEfect)}</span>
                    </div>
                    <div style={E.totChip}>
                      <span style={E.totLbl}>Transferencia</span>
                      <span style={{...E.totVal,color:'#1565c0'}}>{fmtM(totalTransf)}</span>
                    </div>
                  </div>
                </>
              )}

              {egresos.length===0 && !cargando && (
                <div style={{textAlign:'center',padding:50,color:'#aab8d4',fontSize:14}}>
                  Selecciona el período y presiona <strong>Generar Resumen</strong>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

const E = {
  pagina:     {minHeight:'100vh',background:'#d6dce8',padding:10,fontFamily:'Arial,sans-serif'},
  ventana:    {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden',display:'flex',flexDirection:'column'},
  header:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center',gap:12},
  headerTit:  {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center',color:'#fff'},
  btnCerrar:  {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  tabs:       {display:'flex',background:'#dde3ee',borderBottom:'2px solid #8fa4c8'},
  tab:        {padding:'10px 20px',cursor:'pointer',fontSize:13,fontWeight:600,color:'#5577aa',border:'none',background:'transparent',borderBottom:'3px solid transparent'},
  tabActivo:  {color:'#1a3a6b',fontWeight:800,borderBottom:'3px solid #1a3a6b',background:'#fff'},
  contenido:  {padding:'16px',overflowY:'auto',maxHeight:'calc(100vh - 140px)'},
  card:       {background:'#fff',borderRadius:8,padding:'20px',border:'1px solid #dde3ee',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'},
  cardTit:    {fontSize:15,fontWeight:800,color:'#1a3a6b',marginBottom:16,paddingBottom:8,borderBottom:'2px solid #eef2ff'},
  grid2:      {display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 20px'},
  campo:      {display:'flex',flexDirection:'column',gap:4},
  lbl:        {fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase'},
  inp:        {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 10px',fontSize:13,outline:'none',background:'#fff',color:'#1a3a6b'},
  sel:        {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:13,outline:'none',background:'#fff',color:'#1a3a6b'},
  totalBox:   {display:'flex',alignItems:'center',gap:16,background:'#fff8f0',border:'2px solid #ffcc80',borderRadius:8,padding:'12px 18px',marginTop:14},
  msg:        {borderRadius:6,padding:'10px 14px',fontSize:13,fontWeight:600,marginTop:10},
  msgOk:      {background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7'},
  msgErr:     {background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a'},
  btnGuardar: {height:36,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'0 24px',cursor:'pointer',fontSize:13,fontWeight:700},
  btnLimpiar: {height:36,background:'#eef2ff',color:'#1a3a6b',border:'1px solid #c8d5ea',borderRadius:6,padding:'0 16px',cursor:'pointer',fontSize:13,fontWeight:600},
  btnGenerar: {height:32,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'0 18px',cursor:'pointer',fontSize:13,fontWeight:700},
  btnPrint:   {height:32,background:'#2e7d32',color:'#fff',border:'none',borderRadius:6,padding:'0 14px',cursor:'pointer',fontSize:12,fontWeight:700},
  filtros:    {display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end',background:'#fff',padding:'12px 14px',borderRadius:8,marginBottom:12,border:'1px solid #dde3ee'},
  barTotales: {display:'flex',gap:16,flexWrap:'wrap',background:'#fff',padding:'10px 16px',borderRadius:8,marginBottom:12,border:'1px solid #dde3ee'},
  totChip:    {display:'flex',flexDirection:'column',alignItems:'center',gap:2},
  totLbl:     {fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase'},
  totVal:     {fontSize:15,fontWeight:900},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:      {background:'#1a3a6b',position:'sticky',top:0},
  th:         {padding:'7px 10px',color:'#fff',fontWeight:700,fontSize:11,whiteSpace:'nowrap'},
  td:         {padding:'6px 10px',borderBottom:'1px solid #eee',fontSize:12,verticalAlign:'middle'},
  gridCards:  {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10,marginBottom:8},
  cardGrupo:  {background:'#fff',borderRadius:8,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 2px 6px rgba(0,0,0,0.06)',border:'1px solid #eee'},
}
