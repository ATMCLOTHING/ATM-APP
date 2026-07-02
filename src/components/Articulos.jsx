import { useState, useEffect, useRef } from 'react'
import { WZNEW, WZSAVE, WZDELETE, WZCLOSE, WZTOP, WZBACK, WZNEXT, WZEND, WZLOCATE, WZUNDO, WZDUPLICAR } from '../lib/assets'
import ModalNuevaMarca       from './ModalNuevaMarca'
import ModalNuevoProveedor   from './ModalNuevoProveedor'
import ModalListadoArticulos from './ModalListadoArticulos'

const VACIO = {
  codartic:'', tipo:'', tipotalla:'U', descartic:'', genero:'', marca:'',
  cantactual:0, cantfisico:0, codproveed:'', nomproveed:'',
  existencia:0, existminim:0, preciovent:0, preciovend:0, preciovenv:0,
  preciocomp:0, estado:'A', usuario:''
}

const TIPOS   = ['JEAN','SHORT','BLUSA','CAMISA','PANTALON','VESTIDO','FALDA','BERMUDA','LEGGIN','OTRO']
const GENEROS = ['DAMA','CABALLERO','NIÑO','NIÑA','UNISEX']

export default function Articulos({ supabase, onClose }) {
  const [form,       setForm]       = useState({...VACIO})
  const [allIds,     setAllIds]     = useState([])
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [modoNueva,  setModoNueva]  = useState(true)
  const [guardado,   setGuardado]   = useState(false)
  const [marcas,     setMarcas]     = useState([])
  const [provSugg,   setProvSugg]   = useState([])
  const [modal,      setModal]      = useState(null)

  const navPosRef = useRef(null)
  const allIdsRef = useRef([])
  const codRef    = useRef()

  useEffect(()=>{ init() },[])

  async function init() {
    setBusy(true)
    // cargar marcas
    const {data:mdata} = await supabase.from('marcas').select('id,descmarca').order('descmarca')
    setMarcas(mdata||[])
    // cargar artículos
    const {data} = await supabase.from('articulo').select('codartic').order('codartic',{ascending:true})
    const ids=(data||[]).map(r=>r.codartic)
    setAllIds(ids); allIdsRef.current=ids
    if (ids.length>0) await cargarDoc(ids[ids.length-1],ids)
    setBusy(false)
  }

  function upd(k,v){setForm(prev=>({...prev,[k]:v}))}

  async function cargarDoc(id,idsParam) {
    setBusy(true); setMsg(null)
    const {data}=await supabase.from('articulo').select('*').eq('codartic',id).limit(1)
    if(!data||!data.length){setBusy(false);return}
    setForm({...VACIO,...data[0]})
    const ids=idsParam||allIdsRef.current
    const pos=ids.indexOf(id)
    navPosRef.current=pos
    setModoNueva(false); setGuardado(true)
    setBusy(false)
  }

  async function recargarIds(){
    const {data}=await supabase.from('articulo').select('codartic').order('codartic',{ascending:true})
    const ids=(data||[]).map(r=>r.codartic); setAllIds(ids); allIdsRef.current=ids; return ids
  }

  function navPrimero()   {const ids=allIdsRef.current;if(!ids.length)return;navPosRef.current=0;cargarDoc(ids[0])}
  function navAnterior()  {const ids=allIdsRef.current;const p=navPosRef.current;if(p>0){navPosRef.current=p-1;cargarDoc(ids[p-1])}}
  function navSiguiente() {const ids=allIdsRef.current;const p=navPosRef.current;if(p<ids.length-1){navPosRef.current=p+1;cargarDoc(ids[p+1])}}
  function navUltimo()    {const ids=allIdsRef.current;if(!ids.length)return;const l=ids.length-1;navPosRef.current=l;cargarDoc(ids[l])}

  async function nuevoArt(){
    if(modoNueva&&form.descartic){if(!window.confirm('¿Descartar cambios sin guardar?'))return}
    setForm({...VACIO}); setModoNueva(true); setGuardado(false)
    setMsg(null); navPosRef.current=null
    setTimeout(()=>codRef.current?.focus(),100)
  }

  function duplicar(){
    const nuevo={...form,codartic:'',existencia:0,cantactual:0,cantfisico:0}
    setForm(nuevo); setModoNueva(true); setGuardado(false)
    setMsg(null); navPosRef.current=null
    setTimeout(()=>codRef.current?.focus(),100)
  }

  async function guardar(){
    if(!form.codartic.trim()){setMsg({tipo:'err',texto:'El código es obligatorio.'}); return}
    if(!form.descartic.trim()){setMsg({tipo:'err',texto:'La descripción es obligatoria.'}); return}
    setBusy(true)
    try {
      const {error}=await supabase.from('articulo').upsert({...form},{onConflict:'codartic'})
      if(error)throw error

      // sincronizar precios y datos en articomp
      await supabase.from('articomp').update({
        preciocomp:form.preciocomp, preciovent:form.preciovent,
        preciovend:form.preciovend, preciovenv:form.preciovenv,
        descartic:form.descartic, marca:form.marca,
        genero:form.genero, tipo:form.tipo,
      }).eq('codartic',form.codartic)

      // si es artículo nuevo, crear fila en articomp si no existe
      const {data:existe} = await supabase.from('articomp')
        .select('codartic').eq('codartic',form.codartic).limit(1)
      if (!existe || existe.length === 0) {
        await supabase.from('articomp').insert({
          codartic:   form.codartic,
          descartic:  form.descartic,
          talla:      form.tipotalla || 'U',
          marca:      form.marca     || '',
          genero:     form.genero    || '',
          tipo:       form.tipo      || '',
          tipotalla:  form.tipotalla || 'U',
          preciocomp: form.preciocomp || 0,
          preciovent: form.preciovent || 0,
          preciovend: form.preciovend || 0,
          preciovenv: form.preciovenv || 0,
          porciva:    0,
          existencia: form.existencia || 0,
          existminim: form.existminim || 0,
          estado:     form.estado    || 'A',
        })
      }
      setGuardado(true); setModoNueva(false)
      setMsg({tipo:'ok',texto:`✅ Artículo ${form.codartic} guardado.`})
      const ids=await recargarIds()
      const pos=ids.indexOf(form.codartic)
      navPosRef.current=pos
    } catch(e){setMsg({tipo:'err',texto:`❌ ${e.message}`})}
    setBusy(false)
  }

  async function eliminar(){
    if(!window.confirm(`¿Eliminar el artículo ${form.codartic}?`))return
    setBusy(true)
    await supabase.from('articomp').delete().eq('codartic',form.codartic)
    await supabase.from('articulo').delete().eq('codartic',form.codartic)
    setMsg({tipo:'ok',texto:'Artículo eliminado.'})
    const ids=await recargarIds()
    if(ids.length>0) cargarDoc(ids[ids.length-1],ids)
    else {setForm({...VACIO}); setModoNueva(true)}
    setBusy(false)
  }

  async function buscarProv(txt){
    upd('nomproveed',txt)
    if(txt.length<2){setProvSugg([]);return}
    const {data}=await supabase.from('proveedores').select('id,cedrif,nomproveed').ilike('nomproveed',`%${txt}%`).limit(8)
    setProvSugg(data||[])
  }

  function onMarcaGuardada(marca){
    setMarcas(prev=>[...prev,marca].sort((a,b)=>a.descmarca.localeCompare(b.descmarca)))
    upd('marca',marca.descmarca)
    setModal(null)
  }

  function onProvGuardado(prov){
    upd('nomproveed',prov.nomproveed)
    upd('codproveed',prov.cedrif||'')
    setProvSugg([])
    setModal(null)
  }

  const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0})

  return(
    <div style={P.pagina}>
      {modal==='marca'    && <ModalNuevaMarca       supabase={supabase} onGuardar={onMarcaGuardada}  onClose={()=>setModal(null)}/>}
      {modal==='prov'     && <ModalNuevoProveedor   supabase={supabase} onGuardar={onProvGuardado}   onClose={()=>setModal(null)}/>}
      {modal==='listado'  && <ModalListadoArticulos supabase={supabase} onSelect={cod=>cargarDoc(cod)} onClose={()=>setModal(null)}/>}

      <div style={P.ventana}>
        {/* TÍTULO */}
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>ARTÍCULOS / REFERENCIAS</span>
          <div style={P.titCod}>
            {form.codartic
              ? <strong style={{fontSize:18}}>{form.codartic}</strong>
              : <span style={{fontSize:12,opacity:0.7}}>NUEVO</span>}
            {modoNueva&&!guardado&&<span style={P.badgeN}>NUEVO</span>}
          </div>
        </div>

        {/* MENSAJE */}
        {msg&&(
          <div style={{...P.alerta,
            background:msg.tipo==='ok'?'#e8f5e9':'#ffebee',
            color:msg.tipo==='ok'?'#2e7d32':'#c62828',
            border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* FORMULARIO */}
        <div style={P.bloque}>
          {/* FILA 1 */}
          <div style={P.fila}>
            <Campo label="CÓDIGO" w={100}>
              <input ref={codRef} style={{...P.inp,fontWeight:900,fontSize:14,color:'#c0392b'}}
                value={form.codartic}
                onChange={e=>upd('codartic',e.target.value.toUpperCase())}
                onBlur={async e=>{
                  const cod = e.target.value.trim()
                  if(!cod||!modoNueva) return
                  const {data} = await supabase.from('articulo').select('codartic').eq('codartic',cod).limit(1)
                  if(data&&data.length>0) setMsg({tipo:'err',texto:`⚠️ El código "${cod}" ya existe. Elige otro código.`})
                }}
                disabled={guardado&&!modoNueva} placeholder="Código"/>
            </Campo>
            <Campo label="DESCRIPCIÓN" w={300}>
              <input style={P.inp} value={form.descartic} onChange={e=>upd('descartic',e.target.value.toUpperCase())} placeholder="Descripción"/>
            </Campo>
            <Campo label="TIPO" w={140}>
              <select style={P.inp} value={form.tipo} onChange={e=>upd('tipo',e.target.value)}>
                <option value="">--</option>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="GÉNERO" w={130}>
              <select style={P.inp} value={form.genero} onChange={e=>upd('genero',e.target.value)}>
                <option value="">--</option>
                {GENEROS.map(g=><option key={g}>{g}</option>)}
              </select>
            </Campo>
            <Campo label="MARCA" w={160}>
              <div style={{display:'flex',gap:3}}>
                <select style={{...P.inp,flex:1}} value={form.marca} onChange={e=>upd('marca',e.target.value)}>
                  <option value="">--</option>
                  {marcas.map(m=><option key={m.id} value={m.descmarca}>{m.descmarca}</option>)}
                </select>
                <button onClick={()=>setModal('marca')} title="Nueva marca"
                  style={{...P.inp,width:28,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,background:'#e8f5e9',fontWeight:900,fontSize:14}}>+</button>
              </div>
            </Campo>
            <Campo label="ESTADO" w={90}>
              <select style={P.inp} value={form.estado} onChange={e=>upd('estado',e.target.value)}>
                <option value="A">Activo</option>
                <option value="I">Inactivo</option>
              </select>
            </Campo>
          </div>

          {/* FILA 2 — proveedor */}
          <div style={P.fila}>
            <Campo label="COD. PROVEEDOR" w={130}>
              <input style={P.inp} value={form.codproveed} onChange={e=>upd('codproveed',e.target.value)} placeholder="NIT"/>
            </Campo>
            <Campo label="PROVEEDOR" w={320} rel>
              <div style={{display:'flex',gap:3}}>
                <div style={{flex:1,position:'relative'}}>
                  <input style={{...P.inp,width:'100%'}} value={form.nomproveed}
                    onChange={e=>buscarProv(e.target.value)} placeholder="Buscar proveedor…"/>
                  {provSugg.length>0&&(
                    <ul style={P.drop}>
                      {provSugg.map(p=>(
                        <li key={p.id} style={P.dropItem} onClick={()=>{
                          upd('nomproveed',p.nomproveed); upd('codproveed',p.cedrif||''); setProvSugg([])
                        }}>
                          <strong>{p.cedrif}</strong> — {p.nomproveed}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button onClick={()=>setModal('prov')} title="Nuevo proveedor"
                  style={{...P.inp,width:28,padding:0,cursor:'pointer',textAlign:'center',flexShrink:0,background:'#e8f5e9',fontWeight:900,fontSize:14}}>+</button>
              </div>
            </Campo>
          </div>

          {/* FILA 3 — precios */}
          <div style={P.fila}>
            <Campo label="$ COMPRA" w={120}>
              <input type="number" style={P.inp} value={form.preciocomp} min={0} onChange={e=>upd('preciocomp',Number(e.target.value))}/>
            </Campo>
            <Campo label="$ V. MAYOR" w={120}>
              <input type="number" style={P.inp} value={form.preciovent} min={0} onChange={e=>upd('preciovent',Number(e.target.value))}/>
            </Campo>
            <Campo label="$ V. DETAL" w={120}>
              <input type="number" style={P.inp} value={form.preciovend} min={0} onChange={e=>upd('preciovend',Number(e.target.value))}/>
            </Campo>
            <Campo label="$ VENDEDOR" w={120}>
              <input type="number" style={P.inp} value={form.preciovenv} min={0} onChange={e=>upd('preciovenv',Number(e.target.value))}/>
            </Campo>
            <Campo label="EXISTENCIAS" w={110}>
              <input type="number" style={{...P.inp,fontWeight:700,color:form.existencia<=form.existminim&&form.existminim>0?'#c62828':'#1a3a6b'}}
                value={form.existencia} min={0} onChange={e=>upd('existencia',Number(e.target.value))}/>
            </Campo>
            <Campo label="EXIST. MÍN." w={110}>
              <input type="number" style={P.inp} value={form.existminim} min={0} onChange={e=>upd('existminim',Number(e.target.value))}/>
            </Campo>
            <Campo label="CANT. FÍSICA" w={110}>
              <input type="number" style={{...P.inp,...P.ro}} value={form.cantfisico} readOnly/>
            </Campo>
          </div>
        </div>

        {/* FOOTER */}
        <div style={P.footer}>
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <IBtn src={WZTOP}    onClick={navPrimero}           title="Primero"/>
              <IBtn src={WZBACK}   onClick={navAnterior}          title="Anterior"/>
              <IBtn src={WZNEXT}   onClick={navSiguiente}         title="Siguiente"/>
              <IBtn src={WZEND}    onClick={navUltimo}            title="Último"/>
              <IBtn src={WZLOCATE} onClick={()=>setModal('listado')} title="Listado de artículos"/>
            </div>
            <div style={P.btnFila}>
              <IBtn src={WZNEW}      onClick={nuevoArt}             title="Nuevo artículo"/>
              <IBtn src={WZSAVE}     onClick={guardar}              title="Guardar" disabled={busy}/>
              <IBtn src={WZDUPLICAR} onClick={duplicar}             title="Duplicar datos"/>
              <IBtn src={WZUNDO}     onClick={()=>{if(modoNueva&&!guardado){setForm({...VACIO});setMsg(null);setTimeout(()=>codRef.current?.focus(),100)}}} title="Revertir" disabled={!modoNueva||guardado}/>
              <IBtn src={WZDELETE}   onClick={eliminar}             title="Eliminar" disabled={modoNueva&&!guardado}/>
              <IBtn src={WZCLOSE}    onClick={onClose}              title="Volver al menú"/>
            </div>
          </div>

          {/* RESUMEN PRECIOS */}
          {form.codartic&&(
            <div style={{...P.footCol,flex:1,justifyContent:'center',padding:'0 16px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6}}>
                <InfoVal label="$ Compra"   val={`$${fmt(form.preciocomp)}`}/>
                <InfoVal label="$ Mayor"    val={`$${fmt(form.preciovent)}`}  color="#1a3a6b"/>
                <InfoVal label="$ Detal"    val={`$${fmt(form.preciovend)}`}  color="#2e7d32"/>
                <InfoVal label="$ Vendedor" val={`$${fmt(form.preciovenv)}`}  color="#e65100"/>
                <InfoVal label="Existencia" val={form.existencia}
                  color={form.existencia<=form.existminim&&form.existminim>0?'#c62828':'#1a3a6b'} grande/>
                <InfoVal label="Mínimo"     val={form.existminim}/>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({label,w,children,rel}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0,position:rel?'relative':undefined}}>
      <span style={{fontSize:10,fontWeight:700,color:'#1a3a6b',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}
function InfoVal({label,val,color,grande}){
  return(
    <div style={{background:'#fff',border:'1px solid #c8d5ea',borderRadius:5,padding:'4px 8px',textAlign:'center'}}>
      <div style={{fontSize:9,color:'#888',fontWeight:600,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:grande?16:12,fontWeight:700,color:color||'#333'}}>{val}</div>
    </div>
  )
}
function IBtn({src,onClick,title,disabled}){
  return(
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:disabled?'#e8ecf5':'#eef2ff',border:'1px solid #c8d5ea',borderRadius:5,padding:3,
        cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.35:1,
        display:'flex',alignItems:'center',justifyContent:'center',width:42,height:38}}>
      <img src={src} alt={title} style={{width:28,height:28,objectFit:'contain'}}/>
    </button>
  )
}

const P={
  pagina:  {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana: {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1100,margin:'0 auto',overflow:'hidden'},
  titulo:  {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt: {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:  {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  titCod:  {background:'rgba(255,255,255,0.2)',borderRadius:5,padding:'4px 12px',fontSize:13,display:'flex',alignItems:'center',gap:6},
  badgeN:  {fontSize:10,background:'rgba(255,255,255,0.3)',borderRadius:3,padding:'1px 5px'},
  alerta:  {margin:'5px 10px',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX: {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:14},
  bloque:  {margin:'8px 10px',background:'#fff',borderRadius:6,border:'1px solid #c8d5ea',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8},
  fila:    {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:     {height:26,border:'1px solid #aab8d4',borderRadius:3,padding:'0 6px',fontSize:12,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:      {background:'#f0f4ff',color:'#666'},
  drop:    {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:4,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 6px 20px rgba(0,0,0,0.15)',maxHeight:220,overflowY:'auto',minWidth:260},
  dropItem:{padding:'6px 12px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:12},
  footer:  {display:'flex',gap:10,padding:'8px 10px',background:'#dde3ee',borderTop:'2px solid #8fa4c8',alignItems:'center'},
  footCol: {display:'flex',flexDirection:'column',gap:5},
  btnFila: {display:'flex',gap:3},
}
