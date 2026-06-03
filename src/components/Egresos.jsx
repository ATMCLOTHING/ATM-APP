// src/components/Egresos.jsx
import { useState, useEffect, useRef } from 'react'
import { WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE, WZNEW, WZSAVE, WZDELETE, WZPRINT, WZCLOSE } from '../lib/assets'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const MEDIOS = ['EFECTIVO','TRANSFERENCIA','CONSIGNACIÓN','TARJETA DÉBITO','TARJETA CRÉDITO','CHEQUE']

const ENC_VACIO = {
  doc_interno:'', fecha_pago:hoy(), grupo_id:'', tipo_id:'',
  tercero_id:'', cedrif_benef:'', nombre_benef:'', subdetalle:'',
  per_desde:hoy(), per_hasta:hoy(), docto_benef:'',
  subtotal:0, recargos:0, descuento:0, total:0,
  medio_pago:'EFECTIVO', banco:'', cuenta:'', aprobacion:'', observaciones:''
}

export default function Egresos({ supabase, usuario, onClose }) {
  const [form,        setForm]       = useState({...ENC_VACIO})
  const [grupos,      setGrupos]     = useState([])
  const [tipos,       setTipos]      = useState([])
  const [tiposFilt,   setTiposFilt]  = useState([])
  const [terceros,    setTerceros]   = useState([])
  const [terSugg,     setTerSugg]    = useState([])
  const [totalDocs,   setTotalDocs]  = useState(0)
  const [guardado,    setGuardado]   = useState(false)
  const [anulado,     setAnulado]    = useState(false)
  const [modoNuevo,   setModoNuevo]  = useState(false)
  const [busy,        setBusy]       = useState(false)
  const [msg,         setMsg]        = useState(null)
  const [modalBuscar, setModalBuscar]= useState(false)
  const [busqLista,   setBusqLista]  = useState([])
  const [busqTxt,     setBusqTxt]    = useState('')

  const cedulaRef = useRef()

  useEffect(() => { cargarMaestros() }, [])

  async function cargarMaestros() {
    setBusy(true)
    const [{data:g},{data:t},{data:ter}] = await Promise.all([
      supabase.from('egr_grupos').select('*').order('nombre'),
      supabase.from('egr_tipos').select('*,egr_grupos(nombre)').order('nombre'),
      supabase.from('terceros').select('*').eq('activo',true).order('nombre'),
    ])
    setGrupos(g||[])
    setTipos(t||[])
    setTerceros(ter||[])
    // contar docs y cargar último
    const {count} = await supabase.from('egresos').select('id',{count:'exact',head:true})
    setTotalDocs(count||0)
    if ((count||0)>0) {
      const {data:ult} = await supabase.from('egresos').select('doc_interno').order('doc_interno',{ascending:false}).limit(1)
      if (ult?.length) await cargarDoc(ult[0].doc_interno)
    } else {
      await prepararNuevo()
    }
    setBusy(false)
  }

  async function prepararNuevo() {
    const {data,error} = await supabase.rpc('siguiente_egreso')
    const nro = (!error && data) ? data : Date.now()
    setForm({...ENC_VACIO, doc_interno:nro})
    setTiposFilt([])
    setGuardado(false); setAnulado(false); setModoNuevo(true)
    setMsg(null)
    setTimeout(()=>cedulaRef.current?.focus(),100)
  }

  async function nuevoEgreso() {
    if (modoNuevo && (form.nombre_benef||form.subtotal)) {
      if (!window.confirm('¿Descartar los cambios sin guardar?')) return
    }
    await prepararNuevo()
  }

  async function cargarDoc(docInterno) {
    setBusy(true); setMsg(null)
    const {data} = await supabase.from('egresos').select('*').eq('doc_interno',docInterno).limit(1)
    if (!data?.length) { setBusy(false); return }
    const e = data[0]
    setForm({
      doc_interno:  e.doc_interno,
      fecha_pago:   e.fecha_pago?.slice(0,10)||hoy(),
      grupo_id:     e.grupo_id||'',
      tipo_id:      e.tipo_id||'',
      tercero_id:   e.tercero_id||'',
      cedrif_benef: e.cedrif_benef||'',
      nombre_benef: e.nombre_benef||'',
      subdetalle:   e.subdetalle||'',
      per_desde:    e.per_desde?.slice(0,10)||hoy(),
      per_hasta:    e.per_hasta?.slice(0,10)||hoy(),
      docto_benef:  e.docto_benef||'',
      subtotal:     e.subtotal||0,
      recargos:     e.recargos||0,
      descuento:    e.descuento||0,
      total:        e.total||0,
      medio_pago:   e.medio_pago||'EFECTIVO',
      banco:        e.banco||'',
      cuenta:       e.cuenta||'',
      aprobacion:   e.aprobacion||'',
      observaciones:e.observaciones||'',
    })
    // filtrar tipos por grupo
    if (e.grupo_id) setTiposFilt(tipos.filter(t=>t.grupo_id===e.grupo_id))
    setGuardado(true); setAnulado(e.anulado||false); setModoNuevo(false)
    setBusy(false)
  }

  function upd(k,v) {
    setForm(p => {
      const n = {...p,[k]:v}
      // recalcular total
      if (['subtotal','recargos','descuento'].includes(k)) {
        const sub = Number(k==='subtotal'?v:n.subtotal)||0
        const rec = Number(k==='recargos'?v:n.recargos)||0
        const dsc = Number(k==='descuento'?v:n.descuento)||0
        n.total = sub + rec - dsc
      }
      return n
    })
  }

  function onGrupoChange(gid) {
    upd('grupo_id', gid ? Number(gid) : '')
    upd('tipo_id','')
    setTiposFilt(gid ? tipos.filter(t=>t.grupo_id===Number(gid)) : [])
  }

  // Buscar tercero por cédula
  async function onCedulaEnter() {
    const ced = form.cedrif_benef.trim()
    if (!ced) return
    const found = terceros.find(t=>t.cedrif===ced)
    if (found) {
      setForm(p=>({...p, tercero_id:found.id, nombre_benef:found.nombre}))
    } else {
      setMsg({tipo:'warn', texto:`Cédula/RIF "${ced}" no encontrada en terceros. Puedes escribir el nombre manualmente.`})
    }
  }

  function buscarTercero(txt) {
    upd('nombre_benef', txt)
    if (txt.length < 2) { setTerSugg([]); return }
    const b = txt.toLowerCase()
    setTerSugg(terceros.filter(t=>t.nombre.toLowerCase().includes(b)||t.cedrif?.includes(b)).slice(0,8))
  }

  function elegirTercero(t) {
    setForm(p=>({...p, tercero_id:t.id, cedrif_benef:t.cedrif||'', nombre_benef:t.nombre}))
    setTerSugg([])
  }

  async function guardar() {
    if (!form.grupo_id)      { setMsg({tipo:'err',texto:'Selecciona el grupo de egreso.'}); return }
    if (!form.tipo_id)       { setMsg({tipo:'err',texto:'Selecciona el tipo de egreso.'}); return }
    if (!form.nombre_benef.trim()) { setMsg({tipo:'err',texto:'Ingresa el beneficiario.'}); return }
    if (!form.subtotal||Number(form.subtotal)<=0) { setMsg({tipo:'err',texto:'Ingresa un subtotal mayor a cero.'}); return }
    setBusy(true)
    try {
      const rec = {
        doc_interno:   form.doc_interno,
        fecha_pago:    form.fecha_pago,
        grupo_id:      form.grupo_id,
        tipo_id:       form.tipo_id,
        tercero_id:    form.tercero_id||null,
        cedrif_benef:  form.cedrif_benef,
        nombre_benef:  form.nombre_benef,
        subdetalle:    form.subdetalle,
        per_desde:     form.per_desde||null,
        per_hasta:     form.per_hasta||null,
        docto_benef:   form.docto_benef,
        subtotal:      Number(form.subtotal)||0,
        recargos:      Number(form.recargos)||0,
        descuento:     Number(form.descuento)||0,
        total:         Number(form.total)||0,
        medio_pago:    form.medio_pago,
        banco:         form.banco,
        cuenta:        form.cuenta,
        aprobacion:    form.aprobacion,
        observaciones: form.observaciones,
        usuario:       usuario?.usuario||'admin',
        anulado:       false,
      }
      const {error} = await supabase.from('egresos').upsert(rec,{onConflict:'doc_interno'})
      if (error) throw error
      setGuardado(true); setModoNuevo(false)
      setMsg({tipo:'ok', texto:`✅ Egreso ${form.doc_interno} guardado correctamente.`})
      const {count} = await supabase.from('egresos').select('id',{count:'exact',head:true})
      setTotalDocs(count||0)
    } catch(e) { setMsg({tipo:'err',texto:`❌ ${e.message}`}) }
    setBusy(false)
  }

  async function anular() {
    if (!guardado) { setMsg({tipo:'warn',texto:'Este egreso no está guardado aún.'}); return }
    if (anulado)   { setMsg({tipo:'warn',texto:'Este egreso ya está anulado.'}); return }
    const motivo = window.prompt('Motivo de anulación (opcional):')
    if (motivo===null) return
    setBusy(true)
    const {error} = await supabase.from('egresos').update({
      anulado:true, fecha_anula:hoy(), motivo_anula:motivo||'Anulado'
    }).eq('doc_interno',form.doc_interno)
    if (error) { setMsg({tipo:'err',texto:`❌ ${error.message}`}) }
    else { setAnulado(true); setMsg({tipo:'ok',texto:`Egreso ${form.doc_interno} anulado.`}) }
    setBusy(false)
  }

  // Navegación
  async function navPrimero() {
    const {data} = await supabase.from('egresos').select('doc_interno').order('doc_interno',{ascending:true}).limit(1)
    if (data?.length) cargarDoc(data[0].doc_interno)
  }
  async function navAnterior() {
    const {data} = await supabase.from('egresos').select('doc_interno').lt('doc_interno',form.doc_interno).order('doc_interno',{ascending:false}).limit(1)
    if (data?.length) cargarDoc(data[0].doc_interno)
    else setMsg({tipo:'warn',texto:'Este es el primer egreso.'})
  }
  async function navSiguiente() {
    const {data} = await supabase.from('egresos').select('doc_interno').gt('doc_interno',form.doc_interno).order('doc_interno',{ascending:true}).limit(1)
    if (data?.length) cargarDoc(data[0].doc_interno)
    else setMsg({tipo:'warn',texto:'Este es el último egreso.'})
  }
  async function navUltimo() {
    const {data} = await supabase.from('egresos').select('doc_interno').order('doc_interno',{ascending:false}).limit(1)
    if (data?.length) cargarDoc(data[0].doc_interno)
  }

  // Modal buscar
  async function abrirBuscar() {
    const {data} = await supabase.from('egresos')
      .select('doc_interno,fecha_pago,nombre_benef,total,anulado,egr_grupos(nombre)')
      .order('doc_interno',{ascending:false}).limit(200)
    setBusqLista(data||[]); setBusqTxt(''); setModalBuscar(true)
  }
  const busqFiltrada = busqLista.filter(e=>{
    if (!busqTxt) return true
    const b=busqTxt.toLowerCase()
    return String(e.doc_interno).includes(b)||(e.nombre_benef||'').toLowerCase().includes(b)
  })

  const bloqueado = (guardado && !modoNuevo) || anulado

  return (
    <div style={P.pagina}>
      {/* MODAL BUSCAR */}
      {modalBuscar && (
        <div style={P.fondo}>
          <div style={P.modalBusc}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontWeight:800,color:'#1a3a6b',fontSize:14}}>🔍 Buscar Egreso</span>
              <button onClick={()=>setModalBuscar(false)} style={P.btnX}>✕</button>
            </div>
            <input style={{...P.inp,marginBottom:8}} placeholder="Buscar por # doc o beneficiario…"
              value={busqTxt} onChange={e=>setBusqTxt(e.target.value)} autoFocus/>
            <div style={{maxHeight:360,overflowY:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead style={{background:'#1a3a6b',position:'sticky',top:0}}>
                  <tr>{['# Doc','Fecha','Beneficiario','Total','Grupo'].map(h=>(
                    <th key={h} style={{padding:'6px 8px',color:'#fff',fontWeight:700,textAlign:'left'}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {busqFiltrada.map((e,i)=>(
                    <tr key={e.doc_interno} style={{background:i%2===0?'#fff':'#f5f7fc',cursor:'pointer',opacity:e.anulado?0.5:1}}
                      onClick={()=>{cargarDoc(e.doc_interno);setModalBuscar(false)}}>
                      <td style={{padding:'5px 8px',fontWeight:700,color:'#1a3a6b'}}>{e.doc_interno}</td>
                      <td style={{padding:'5px 8px'}}>{e.fecha_pago}</td>
                      <td style={{padding:'5px 8px'}}>{e.nombre_benef}</td>
                      <td style={{padding:'5px 8px',textAlign:'right',fontWeight:600}}>${fmt(e.total)}</td>
                      <td style={{padding:'5px 8px',fontSize:11,color:'#555'}}>{e.egr_grupos?.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div style={P.ventana}>
        {/* TÍTULO */}
        <div style={P.titulo}>
          <div style={{display:'flex',flexDirection:'column',marginRight:14,lineHeight:1}}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>PAGO DE CUENTAS / EGRESOS</span>
          <div style={P.titNro}>
            N° <strong style={{fontSize:20}}>{form.doc_interno}</strong>
            {modoNuevo && <span style={P.badgeNuevo}>NUEVO</span>}
            {anulado   && <span style={P.badgeAnul}>ANULADO</span>}
          </div>
        </div>

        {msg && (
          <div style={{...P.alerta,
            background:msg.tipo==='ok'?'#e8f5e9':msg.tipo==='warn'?'#fff8e1':'#ffebee',
            color:msg.tipo==='ok'?'#2e7d32':msg.tipo==='warn'?'#e65100':'#c62828',
            border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':msg.tipo==='warn'?'#ffe082':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* BLOQUE 1 — Tipo y fecha */}
        <div style={P.bloque}>
          <div style={P.fila}>
            <Fld label="Grupo de Egreso" w={260}>
              <select style={P.inp} value={form.grupo_id} onChange={e=>onGrupoChange(e.target.value)} disabled={anulado}>
                <option value="">— Selecciona grupo —</option>
                {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </Fld>
            <Fld label="Tipo de Egreso" w={300}>
              <select style={P.inp} value={form.tipo_id} onChange={e=>upd('tipo_id',e.target.value?Number(e.target.value):'')} disabled={anulado||!form.grupo_id}>
                <option value="">— Selecciona tipo —</option>
                {tiposFilt.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha Pago" w={140}>
              <input type="date" style={P.inp} value={form.fecha_pago} onChange={e=>upd('fecha_pago',e.target.value)} disabled={anulado}/>
            </Fld>
          </div>
        </div>

        {/* BLOQUE 2 — Beneficiario */}
        <div style={P.bloque}>
          <div style={P.fila}>
            <Fld label="Céd/RIF Benef." w={150}>
              <input ref={cedulaRef} style={P.inp} value={form.cedrif_benef}
                onChange={e=>upd('cedrif_benef',e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&onCedulaEnter()}
                placeholder="Cédula o RIF…" disabled={anulado}/>
            </Fld>
            <Fld label="Nombre / Razón Social" w={320}>
              <div style={{position:'relative'}}>
                <input style={P.inp} value={form.nombre_benef}
                  onChange={e=>buscarTercero(e.target.value)}
                  placeholder="Nombre beneficiario…" disabled={anulado}/>
                {terSugg.length>0&&(
                  <ul style={P.drop}>
                    {terSugg.map(t=>(
                      <li key={t.id} style={P.dropItem} onClick={()=>elegirTercero(t)}>
                        <strong>{t.cedrif}</strong> — {t.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Fld>
            <Fld label="Sub-Detalle" w={280}>
              <input style={P.inp} value={form.subdetalle} onChange={e=>upd('subdetalle',e.target.value)} placeholder="Detalle adicional…" disabled={anulado}/>
            </Fld>
          </div>
          <div style={P.fila}>
            <Fld label="Per. Desde" w={140}>
              <input type="date" style={P.inp} value={form.per_desde} onChange={e=>upd('per_desde',e.target.value)} disabled={anulado}/>
            </Fld>
            <Fld label="Per. Hasta" w={140}>
              <input type="date" style={P.inp} value={form.per_hasta} onChange={e=>upd('per_hasta',e.target.value)} disabled={anulado}/>
            </Fld>
            <Fld label="Docto. Benef." w={160}>
              <input style={P.inp} value={form.docto_benef} onChange={e=>upd('docto_benef',e.target.value)} placeholder="# documento…" disabled={anulado}/>
            </Fld>
            <Fld label="Doc Interno" w={120}>
              <input style={{...P.inp,...P.ro}} value={form.doc_interno} readOnly/>
            </Fld>
          </div>
        </div>

        {/* BLOQUE 3 — Valores */}
        <div style={P.bloque}>
          <div style={P.fila}>
            <Fld label="$ Subtotal" w={150}>
              <input type="number" style={{...P.inp,textAlign:'right',fontWeight:700,fontSize:14}} value={form.subtotal} min={0}
                onChange={e=>upd('subtotal',e.target.value)} disabled={anulado}/>
            </Fld>
            <Fld label="$ Recargos" w={140}>
              <input type="number" style={{...P.inp,textAlign:'right'}} value={form.recargos} min={0}
                onChange={e=>upd('recargos',e.target.value)} disabled={anulado}/>
            </Fld>
            <Fld label="$ Descuento" w={140}>
              <input type="number" style={{...P.inp,textAlign:'right'}} value={form.descuento} min={0}
                onChange={e=>upd('descuento',e.target.value)} disabled={anulado}/>
            </Fld>
            <Fld label="$ Total" w={160}>
              <input style={{...P.inp,...P.ro,textAlign:'right',fontWeight:900,fontSize:16,color:'#1a3a6b'}} value={fmt(form.total)} readOnly/>
            </Fld>
          </div>
          <div style={P.fila}>
            <Fld label="Medio de Pago" w={200}>
              <select style={P.inp} value={form.medio_pago} onChange={e=>upd('medio_pago',e.target.value)} disabled={anulado}>
                {MEDIOS.map(m=><option key={m}>{m}</option>)}
              </select>
            </Fld>
            {['TRANSFERENCIA','CONSIGNACIÓN','CHEQUE'].includes(form.medio_pago) && <>
              <Fld label="Banco" w={180}>
                <input style={P.inp} value={form.banco} onChange={e=>upd('banco',e.target.value)} placeholder="Nombre banco…" disabled={anulado}/>
              </Fld>
              <Fld label="Cuenta" w={180}>
                <input style={P.inp} value={form.cuenta} onChange={e=>upd('cuenta',e.target.value)} placeholder="# cuenta…" disabled={anulado}/>
              </Fld>
            </>}
            <Fld label="# Aprobación" w={160}>
              <input style={P.inp} value={form.aprobacion} onChange={e=>upd('aprobacion',e.target.value)} placeholder="Código aprobación…" disabled={anulado}/>
            </Fld>
          </div>
          <Fld label="Observaciones" w="100%">
            <input style={{...P.inp,width:'100%'}} value={form.observaciones} onChange={e=>upd('observaciones',e.target.value)} placeholder="Observaciones adicionales…" disabled={anulado}/>
          </Fld>
        </div>

        {/* FOOTER — Botones */}
        <div style={P.footer}>
          <div style={P.btnFila}>
            <IBtn src={WZTOP}    onClick={navPrimero}          title="Primero"/>
            <IBtn src={WZBACK}   onClick={navAnterior}         title="Anterior"/>
            <IBtn src={WZNEXT}   onClick={navSiguiente}        title="Siguiente"/>
            <IBtn src={WZEND}    onClick={navUltimo}           title="Último"/>
            <IBtn src={WZLOCATE} onClick={abrirBuscar}         title="Buscar"/>
          </div>
          <div style={P.btnFila}>
            <IBtn src={WZNEW}    onClick={nuevoEgreso}         title="Nuevo" disabled={modoNuevo&&!(form.nombre_benef||form.subtotal)}/>
            <IBtn src={WZSAVE}   onClick={guardar}             title="Guardar" disabled={busy||anulado}/>
            <IBtn src={WZDELETE} onClick={anular}              title="Anular" disabled={anulado||modoNuevo}/>
            <IBtn src={WZCLOSE}  onClick={onClose}             title="Volver al menú"/>
          </div>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:8}}>
            <span style={{fontSize:11,color:'#888'}}>{totalDocs} egreso(s) registrado(s)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fld({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0}}>
      <span style={{fontSize:10,fontWeight:700,color:'#5577aa',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function IBtn({src,onClick,title,disabled}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:6,padding:4,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.35:1,display:'flex',alignItems:'center',justifyContent:'center',width:44,height:40}}>
      <img src={src} alt={title} style={{width:30,height:30,objectFit:'contain'}}/>
    </button>
  )
}

const P={
  pagina:    {minHeight:'100vh',background:'#dde3ee',padding:12},
  ventana:   {background:'#f4f6fb',borderRadius:12,border:'1px solid #c8d5ea',boxShadow:'0 4px 24px rgba(0,0,0,0.12)',maxWidth:1100,margin:'0 auto',overflow:'hidden'},
  titulo:    {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'10px 18px',display:'flex',alignItems:'center'},
  titTxt:    {fontWeight:900,fontSize:17,letterSpacing:2,flex:1,textAlign:'center'},
  titNro:    {background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'5px 16px',fontSize:14,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:8},
  badgeNuevo:{fontSize:10,background:'rgba(255,255,255,0.25)',borderRadius:4,padding:'2px 7px'},
  badgeAnul: {fontSize:10,background:'#e74c3c',borderRadius:4,padding:'2px 7px'},
  alerta:    {margin:'6px 12px',padding:'8px 14px',borderRadius:6,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:   {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:16},
  bloque:    {margin:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #e0e7f0',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8},
  fila:      {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:       {height:30,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:13,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:        {background:'#f8faff',color:'#555'},
  drop:      {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',maxHeight:220,overflowY:'auto',minWidth:340,width:'100%'},
  dropItem:  {padding:'8px 14px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:13},
  footer:    {display:'flex',gap:12,flexWrap:'wrap',padding:'10px 14px',background:'#eef2ff',borderTop:'2px solid #c8d5ea',alignItems:'center'},
  btnFila:   {display:'flex',gap:4},
  fondo:     {position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300},
  modalBusc: {background:'#fff',borderRadius:8,padding:20,width:700,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.3)'},
  btnX:      {background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700},
}
