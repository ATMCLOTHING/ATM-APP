import { useState, useEffect, useRef } from 'react'
import { WZNEW, WZSAVE, WZDELETE, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE } from '../lib/assets'
import ModalNuevoTipoProveedor from './ModalNuevoTipoProveedor'

const VACIO = {
  tipoprovee:'', nomproveed:'', cedrif:'', direccion:'', ciudad:'',
  telefono:'', celular:'', nombrevend:'', email:'', descprov:'',
  diaspago:0, limitecred:0
}

export default function Proveedores({ supabase, onClose }) {
  const [form,     setForm]     = useState({...VACIO})
  const [allIds,   setAllIds]   = useState([])
  const [busy,     setBusy]     = useState(false)
  const [msg,      setMsg]      = useState(null)
  const [modoNuevo,setModoNuevo]= useState(true)
  const [guardado, setGuardado] = useState(false)
  const [tiposProv, setTiposProv] = useState([])
  const [modal,     setModal]     = useState(null) // 'nuevoTipo'

  const navPosRef = useRef(null)
  const allIdsRef = useRef([])
  const cedRef    = useRef()

  useEffect(()=>{ init() },[])
  useEffect(()=>{
    supabase.from('tipos_proveedor').select('id,nombre').order('nombre')
      .then(({data}) => { if (data) setTiposProv(data) })
  },[])

  function onTipoCreado(t) {
    setTiposProv(prev => [...prev, t].sort((a,b)=>a.nombre.localeCompare(b.nombre)))
    upd('tipoprovee', t.nombre)
    setModal(null)
  }

  async function init() {
    setBusy(true)
    const {data} = await supabase.from('proveedores').select('id,nomproveed').order('nomproveed')
    const ids=(data||[]).map(r=>r.id)
    setAllIds(ids); allIdsRef.current=ids
    if (ids.length>0) await cargarDoc(ids[ids.length-1],ids)
    setBusy(false)
  }

  function upd(campo,val){setForm(prev=>({...prev,[campo]:val}))}

  async function cargarDoc(id,idsParam) {
    setBusy(true); setMsg(null)
    const {data}=await supabase.from('proveedores').select('*').eq('id',id).limit(1)
    if(!data||!data.length){setBusy(false);return}
    setForm({...VACIO,...data[0]})
    const ids=idsParam||allIdsRef.current
    const pos=ids.indexOf(id)
    navPosRef.current=pos
    setModoNuevo(false); setGuardado(true)
    setBusy(false)
  }

  async function recargarIds(){
    const {data}=await supabase.from('proveedores').select('id').order('nomproveed')
    const ids=(data||[]).map(r=>r.id); setAllIds(ids); allIdsRef.current=ids; return ids
  }

  function navPrimero()  {const ids=allIdsRef.current;if(!ids.length)return;navPosRef.current=0;cargarDoc(ids[0])}
  function navAnterior() {const ids=allIdsRef.current;const p=navPosRef.current;if(p>0){navPosRef.current=p-1;cargarDoc(ids[p-1])}}
  function navSiguiente(){const ids=allIdsRef.current;const p=navPosRef.current;if(p<ids.length-1){navPosRef.current=p+1;cargarDoc(ids[p+1])}}
  function navUltimo()   {const ids=allIdsRef.current;if(!ids.length)return;const l=ids.length-1;navPosRef.current=l;cargarDoc(ids[l])}

  async function nuevoProv(){
    if(modoNuevo&&form.nomproveed){if(!window.confirm('¿Descartar cambios?'))return}
    setForm({...VACIO}); setModoNuevo(true); setGuardado(false); setMsg(null)
    setTimeout(()=>cedRef.current?.focus(),100)
  }

  async function guardar(){
    if(!form.nomproveed.trim()){setMsg({tipo:'err',texto:'El nombre es obligatorio.'}); return}
    setBusy(true)
    try {
      if(guardado&&form.id){
        const {error}=await supabase.from('proveedores').update(form).eq('id',form.id)
        if(error)throw error
      } else {
        const {error}=await supabase.from('proveedores').insert({...form})
        if(error)throw error
      }
      setGuardado(true); setModoNuevo(false)
      setMsg({tipo:'ok',texto:`✅ Proveedor "${form.nomproveed}" guardado.`})
      await recargarIds()
    } catch(e){setMsg({tipo:'err',texto:`❌ ${e.message}`})}
    setBusy(false)
  }

  async function eliminar(){
    if(!window.confirm(`¿Eliminar el proveedor "${form.nomproveed}"?`))return
    setBusy(true)
    await supabase.from('proveedores').delete().eq('id',form.id)
    setMsg({tipo:'ok',texto:'Proveedor eliminado.'})
    const ids=await recargarIds()
    if(ids.length>0) cargarDoc(ids[ids.length-1],ids)
    else {setForm({...VACIO}); setModoNuevo(true)}
    setBusy(false)
  }

  return(
    <div style={P.pagina}>
      {modal==='nuevoTipo' && <ModalNuevoTipoProveedor supabase={supabase} onGuardar={onTipoCreado} onClose={()=>setModal(null)}/>}
      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>PROVEEDORES</span>
          <div style={P.titInfo}>
            {form.nomproveed||<span style={{opacity:0.7,fontSize:12}}>NUEVO</span>}
          </div>
        </div>

        {msg&&(
          <div style={{...P.alerta,background:msg.tipo==='ok'?'#e8f5e9':'#ffebee',color:msg.tipo==='ok'?'#2e7d32':'#c62828',border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        <div style={P.bloque}>
          <div style={P.fila}>
            <Campo label="Cédula / NIT" w={150}>
              <input ref={cedRef} style={{...P.inp,fontWeight:700}} value={form.cedrif||''} onChange={e=>upd('cedrif',e.target.value)} placeholder="Cédula o NIT"/>
            </Campo>
            <Campo label="Nombre / Razón Social" w={320}>
              <input style={P.inp} value={form.nomproveed||''} onChange={e=>upd('nomproveed',e.target.value.toUpperCase())} placeholder="Nombre del proveedor"/>
            </Campo>
            <Campo label="Tipo" w={220}>
              <div style={{display:'flex',gap:3}}>
                <select style={{...P.inp,flex:1}} value={form.tipoprovee||''} onChange={e=>upd('tipoprovee',e.target.value)}>
                  <option value="">-- Selecciona --</option>
                  {tiposProv.map(t=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </select>
                <button onClick={()=>setModal('nuevoTipo')} title="Nuevo tipo de proveedor"
                  style={{...P.inp,width:28,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,background:'#e8f5e9',fontWeight:900,fontSize:14}}>+</button>
              </div>
            </Campo>
            <Campo label="Descripción" w={200}>
              <input style={P.inp} value={form.descprov||''} onChange={e=>upd('descprov',e.target.value)} placeholder="Servicios, insumos…"/>
            </Campo>
          </div>
          <div style={P.fila}>
            <Campo label="Dirección" w={250}>
              <input style={P.inp} value={form.direccion||''} onChange={e=>upd('direccion',e.target.value)}/>
            </Campo>
            <Campo label="Ciudad" w={150}>
              <input style={P.inp} value={form.ciudad||''} onChange={e=>upd('ciudad',e.target.value.toUpperCase())}/>
            </Campo>
            <Campo label="Teléfono" w={130}>
              <input style={P.inp} value={form.telefono||''} onChange={e=>upd('telefono',e.target.value)}/>
            </Campo>
            <Campo label="Celular" w={130}>
              <input style={P.inp} value={form.celular||''} onChange={e=>upd('celular',e.target.value)}/>
            </Campo>
          </div>
          <div style={P.fila}>
            <Campo label="Contacto" w={200}>
              <input style={P.inp} value={form.nombrevend||''} onChange={e=>upd('nombrevend',e.target.value)}/>
            </Campo>
            <Campo label="Email" w={230}>
              <input type="email" style={P.inp} value={form.email||''} onChange={e=>upd('email',e.target.value)}/>
            </Campo>
            <Campo label="Días de Pago" w={110}>
              <input type="number" style={P.inp} value={form.diaspago||0} min={0} onChange={e=>upd('diaspago',Number(e.target.value))}/>
            </Campo>
            <Campo label="Límite Crédito" w={130}>
              <input type="number" style={P.inp} value={form.limitecred||0} min={0} onChange={e=>upd('limitecred',Number(e.target.value))}/>
            </Campo>
          </div>
        </div>

        <div style={P.footer}>
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}  title="Primero"/>
              <IBtn src={WZBACK}   onClick={navAnterior} title="Anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente}title="Siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}   title="Último"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW}    onClick={nuevoProv}  title="Nuevo proveedor"/>
              <IBtn src={WZSAVE}   onClick={guardar}    title="Guardar" disabled={busy}/>
              <IBtn src={WZDELETE} onClick={eliminar}   title="Eliminar" disabled={modoNuevo&&!guardado}/>
              <IBtn src={WZCLOSE}  onClick={onClose}    title="Volver al menú"/>
            </div>
          </div>
          <div style={{padding:'0 20px',color:'#5577aa',fontSize:12}}>
            {allIds.length} proveedor(es) registrado(s)
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0}}>
      <span style={{fontSize:10,fontWeight:700,color:'#1a3a6b',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function IBtn({src,onClick,title,disabled}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:disabled?'#e8ecf5':'#eef2ff',border:'1px solid #c8d5ea',borderRadius:5,padding:4,
        cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.35:1,
        display:'flex',alignItems:'center',justifyContent:'center',width:55,height:49}}>
      <img src={src} alt={title} style={{width:36,height:36,objectFit:'contain'}}/>
    </button>
  )
}

const P={
  pagina:  {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana: {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1000,margin:'0 auto',overflow:'hidden'},
  titulo:  {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt: {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:  {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  titInfo: {background:'rgba(255,255,255,0.2)',borderRadius:5,padding:'4px 12px',fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  alerta:  {margin:'5px 10px',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX: {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:18},
  bloque:  {margin:'8px 10px',background:'#fff',borderRadius:6,border:'1px solid #c8d5ea',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8},
  fila:    {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:     {height:26,border:'1px solid #aab8d4',borderRadius:3,padding:'0 6px',fontSize:12,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  footer:  {display:'flex',gap:10,padding:'8px 10px',background:'#dde3ee',borderTop:'2px solid #8fa4c8',alignItems:'center'},
  footCol: {display:'flex',flexDirection:'column',gap:5},
  btnFila: {display:'flex',gap:3},
}
