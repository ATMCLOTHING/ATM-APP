// src/components/NotaDeEntrega.jsx
import { useState, useEffect } from 'react'
import ModalAbonos  from './ModalAbonos'
import ModalResumen from './ModalResumen'
import ModalDetalle from './ModalDetalle'
import PrintNota    from './PrintNota'

const fmt = (n) => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => new Date().toISOString().slice(0,10)
const VACIA = { codartic:'', descartic:'', talla:'', cantidad:'', valunit:0, porciva:0, valiva:0, porcdescue:0, valdescue:0, valtotal:0 }
const FILAS = () => Array.from({length:12}, () => ({...VACIA}))
const PLAZOS = ['CONTADO','15 DÍAS','30 DÍAS','60 DÍAS','90 DÍAS']
const MEDIOS = ['Efectivo','Transferencia','Mixto','Crédito']
const IC = (name) => `/icons/${name}.png`

export default function NotaDeEntrega({ supabase, onClose }) {
  const [nroDoc,    setNroDoc]    = useState('')
  const [fecha,     setFecha]     = useState(hoy())
  const [fechaPago, setFechaPago] = useState(hoy())
  const [plazo,     setPlazo]     = useState('CONTADO')
  const [pDescto,   setPDescto]   = useState(0)
  const [pIva,      setPIva]      = useState(0)
  const [tipoVta,   setTipoVta]   = useState('Mayor')
  const [medio,     setMedio]     = useState('Efectivo')
  const [codCli,    setCodCli]    = useState('99')
  const [cliTxt,    setCliTxt]    = useState('CLIENTE GENERAL')
  const [cliente,   setCliente]   = useState({nombreclie:'CLIENTE GENERAL',ciudad:'MEDELLÍN'})
  const [cliSugg,   setCliSugg]   = useState([])
  const [cedVend,   setCedVend]   = useState('')
  const [vendedor,  setVendedor]  = useState(null)
  const [lineas,    setLineas]    = useState(FILAS())
  const [artSugg,   setArtSugg]   = useState([])
  const [artIdx,    setArtIdx]    = useState(null)
  const [abonos,    setAbonos]    = useState(0)
  const [allIds,    setAllIds]    = useState([])
  const [navPos,    setNavPos]    = useState(null)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [modal,     setModal]     = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const {data} = await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids = (data||[]).map(r=>r.numnotaent)
    setAllIds(ids)
    setNroDoc(String(ids.length ? Number(ids[ids.length-1])+1 : 1))
    cargarCliente('99')
  }

  async function cargarCliente(cod) {
    if (!cod) return
    const {data} = await supabase.from('clientes').select('*').eq('codclient',cod).maybeSingle()
    if (data) { setCliente(data); setCliTxt(data.nombreclie); setCodCli(data.codclient) }
  }

  async function buscarCliente(txt) {
    setCliTxt(txt)
    if (txt.length<2) { setCliSugg([]); return }
    const esNum = /^\d+$/.test(txt)
    const q = supabase.from('clientes').select('codclient,nombreclie,cedrifclie,celular,ciudad,departamen,direcicion,nomempresa')
    const {data} = await (esNum
      ? q.or(`codclient.eq.${txt},cedrifclie.ilike.%${txt}%`)
      : q.ilike('nombreclie',`%${txt}%`)
    ).limit(8)
    setCliSugg(data||[])
  }

  function elegirCliente(c) {
    setCliente(c); setCodCli(c.codclient); setCliTxt(c.nombreclie); setCliSugg([])
  }

  async function cargarVendedor(ced) {
    if (!ced) return
    const {data} = await supabase.from('vendedor').select('*').eq('cedvended',ced).maybeSingle()
    setVendedor(data||null)
  }

  async function buscarArt(txt, idx) {
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:txt}; return n })
    if (txt.length<2) { setArtSugg([]); setArtIdx(null); return }
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,porciva,existencia')
      .or(`codartic.ilike.%${txt}%,descartic.ilike.%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],descartic:txt}; return n })
    if (txt.length<2) { setArtSugg([]); setArtIdx(null); return }
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,porciva,existencia')
      .ilike('descartic',`%${txt}%`).limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  function elegirArt(art, idx) {
    const precio = tipoVta==='Vendedor' ? (art.preciovend||art.preciovent) : art.preciovent
    upd(idx,{codartic:art.codartic,descartic:art.descartic,talla:art.talla||'',valunit:precio||0,porciva:art.porciva||0})
    setArtSugg([]); setArtIdx(null)
  }

  function upd(idx, cambios) {
    setLineas(prev => {
      const sig=[...prev]
      const lin={...sig[idx],...cambios}
      const cant=Number(lin.cantidad)||0
      const sub=cant*(Number(lin.valunit)||0)
      const dcto=sub*((Number(lin.porcdescue)||0)/100)
      const base=sub-dcto
      const iva=base*((Number(lin.porciva)||0)/100)
      lin.valdescue=dcto; lin.valiva=iva; lin.valtotal=base+iva
      sig[idx]=lin
      if (idx===sig.length-1 && (cambios.codartic||cambios.descartic)) sig.push({...VACIA})
      return sig
    })
  }

  function quitarLinea(idx) {
    setLineas(prev=>prev.length>1?prev.filter((_,i)=>i!==idx):prev)
  }

  const detValidas = lineas.filter(l=>l.codartic&&Number(l.cantidad)>0)
  const subtotal   = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDcto    = lineas.reduce((s,l)=>s+(l.valdescue||0),0)
  const totIva     = lineas.reduce((s,l)=>s+(l.valiva||0),0)
  const total      = lineas.reduce((s,l)=>s+(l.valtotal||0),0)
  const saldo      = total-abonos
  const prendas    = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  async function cargarDoc(id) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).maybeSingle()
    if (!enc) { setBusy(false); return }
    setNroDoc(enc.numnotaent)
    setFecha(enc.fechanotae?.slice(0,10)||hoy())
    setFechaPago(enc.fechavence?.slice(0,10)||hoy())
    setPlazo(enc.formapago||'CONTADO'); setMedio(enc.mediopago||'Efectivo')
    setPDescto(enc.porcdescue||0); setPIva(enc.porciva||0)
    setCodCli(enc.codclient||'99'); setCedVend(enc.cedvended||'')
    if (enc.cedvended) cargarVendedor(enc.cedvended)
    const {data:cli} = await supabase.from('clientes').select('*').eq('codclient',enc.codclient).maybeSingle()
    setCliente(cli||null); setCliTxt(cli?.nombreclie||enc.nombreclie||'')
    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const extras = Math.max(0,12-(det?.length||0))
    setLineas(det?.length ? [...det,...Array.from({length:extras},()=>({...VACIA}))] : FILAS())
    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))
    setBusy(false)
  }

  async function recargarIds() {
    const {data} = await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids=(data||[]).map(r=>r.numnotaent); setAllIds(ids); return ids
  }

  function navPrimero()   { if(allIds.length){setNavPos(0);cargarDoc(allIds[0])} }
  function navAnterior()  { const p=navPos??allIds.length; if(p>0){setNavPos(p-1);cargarDoc(allIds[p-1])} }
  function navSiguiente() { if(navPos!==null&&navPos<allIds.length-1){setNavPos(navPos+1);cargarDoc(allIds[navPos+1])} }
  function navUltimo()    { if(allIds.length){const l=allIds.length-1;setNavPos(l);cargarDoc(allIds[l])} }

  async function nuevaNota() {
    const ids = await recargarIds()
    setNroDoc(String(ids.length ? Number(ids[ids.length-1])+1 : 1))
    setFecha(hoy()); setFechaPago(hoy())
    setPlazo('CONTADO'); setMedio('Efectivo')
    setPDescto(0); setPIva(0); setTipoVta('Mayor')
    setCodCli('99'); setCliTxt('CLIENTE GENERAL')
    setCliente({nombreclie:'CLIENTE GENERAL',ciudad:'MEDELLÍN'})
    setCedVend(''); setVendedor(null)
    setLineas(FILAS()); setAbonos(0)
    setMsg(null); setNavPos(null)
  }

  async function guardar() {
    if (!detValidas.length) { setMsg({tipo:'err',texto:'Agrega al menos un artículo con cantidad.'}); return }
    setBusy(true)
    try {
      const enc = {
        numnotaent:nroDoc, fechanotae:fecha, fechavence:fechaPago,
        formapago:plazo, mediopago:medio,
        codclient:codCli, nombreclie:cliente?.nombreclie||cliTxt,
        cedrifclie:cliente?.cedrifclie||'', direcicion:cliente?.direcicion||'',
        celular:cliente?.celular||'', ciudad:cliente?.ciudad||'',
        departamen:cliente?.departamen||'', nomempresa:cliente?.nomempresa||'',
        porcdescue:pDescto, porciva:pIva,
        subtotal, valdescue:totDcto, valiva:totIva, valtotal:total,
        valabono:abonos, saldo, cedvended:cedVend,
        cantotal:prendas, anulada:'N',
      }
      const {error:e1} = await supabase.from('encnotaen').upsert(enc,{onConflict:'numnotaent'})
      if (e1) throw e1
      await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
      const filas = detValidas.map(l=>({
        numnotaent:nroDoc, codartic:l.codartic, descartic:l.descartic,
        talla:l.talla, cantidad:Number(l.cantidad), valunit:Number(l.valunit),
        subtotal:Number(l.cantidad)*Number(l.valunit),
        porciva:l.porciva, valiva:l.valiva, porcdescue:l.porcdescue,
        valdescue:l.valdescue, valtotal:l.valtotal,
      }))
      const {error:e2} = await supabase.from('detnotaen').insert(filas)
      if (e2) throw e2
      setMsg({tipo:'ok',texto:`✅ Nota ${nroDoc} guardada correctamente.`})
      const ids = await recargarIds()
      setNavPos(ids.indexOf(nroDoc))
    } catch(e) {
      setMsg({tipo:'err',texto:`❌ Error: ${e.message}`})
    }
    setBusy(false)
  }

  async function anular() {
    if (!window.confirm(`¿Anular la nota ${nroDoc}? No se puede deshacer.`)) return
    setBusy(true)
    await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
    await supabase.from('detabonos').delete().eq('numnotaent',nroDoc)
    await supabase.from('encnotaen').delete().eq('numnotaent',nroDoc)
    setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada.`})
    setBusy(false); nuevaNota()
  }

  const dataNota = {nroDoc,fecha,fechaPago,plazo,medio,cliente,cliTxt,codCli,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos}

  return (
    <div style={P.pagina}>
      {modal==='abonos'  && <ModalAbonos  supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} onClose={()=>{setModal(null);cargarDoc(nroDoc)}} />}
      {modal==='resumen' && <ModalResumen supabase={supabase} onClose={()=>setModal(null)} />}
      {modal==='detalle' && <ModalDetalle nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)} />}
      {modal==='print'   && <PrintNota datos={dataNota} onClose={()=>setModal(null)} />}

      <div style={P.ventana}>
        {/* ── TÍTULO ── */}
        <div style={P.titulo}>
          <div style={P.tituloIzq}>
            <img src="/LogoATM.png" alt="ATM" style={{height:38,filter:'brightness(0) invert(1)'}} />
          </div>
          <div style={P.tituloCentro}>NOTA DE ENTREGA</div>
          <div style={P.tituloNro}>N° <span style={{fontSize:20,fontWeight:900}}>{nroDoc}</span></div>
        </div>

        {/* ── MENSAJE ── */}
        {msg && (
          <div style={{...P.alerta,background:msg.tipo==='ok'?'#e8f5e9':'#ffebee',color:msg.tipo==='ok'?'#2e7d32':'#c62828',border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* ── DATOS EN UN SOLO BLOQUE ── */}
        <div style={P.bloque}>
          {/* FILA 1: cédula/nit, nombre, empresa */}
          <div style={P.fila}>
            <Fld label="Cédula / NIT" w={110} rel>
              <input style={P.inp} value={codCli}
                onChange={e=>setCodCli(e.target.value)}
                onBlur={()=>cargarCliente(codCli)} />
            </Fld>
            <Fld label="Nombre / Razón Social" w={320} rel>
              <input style={P.inp} value={cliTxt}
                onChange={e=>buscarCliente(e.target.value)}
                placeholder="Buscar por nombre o cédula…" />
              {cliSugg.length>0 && (
                <ul style={P.drop}>
                  {cliSugg.map(c=>(
                    <li key={c.codclient} style={P.dropItem} onClick={()=>elegirCliente(c)}>
                      <strong>{c.codclient}</strong> — {c.nombreclie}
                      {c.cedrifclie&&<span style={{color:'#888',fontSize:11}}> · {c.cedrifclie}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Fld>
            <Fld label="Empresa" w={200}>
              <input style={{...P.inp,...P.ro}} value={cliente?.nomempresa||''} readOnly />
            </Fld>
          </div>
          {/* FILA 2: dirección, celular, ciudad, depto */}
          <div style={P.fila}>
            <Fld label="Dirección" w={230}>
              <input style={{...P.inp,...P.ro}} value={cliente?.direcicion||''} readOnly />
            </Fld>
            <Fld label="Celular" w={130}>
              <input style={{...P.inp,...P.ro}} value={cliente?.celular||''} readOnly />
            </Fld>
            <Fld label="Ciudad" w={150}>
              <input style={{...P.inp,...P.ro}} value={cliente?.ciudad||''} readOnly />
            </Fld>
            <Fld label="Depto." w={120}>
              <input style={{...P.inp,...P.ro}} value={cliente?.departamen||''} readOnly />
            </Fld>
          </div>
          {/* FILA 3: fechas, descuento, iva */}
          <div style={P.fila}>
            <Fld label="Fecha" w={140}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)} />
            </Fld>
            <Fld label="Plazo de Pago" w={150}>
              <select style={P.inp} value={plazo} onChange={e=>setPlazo(e.target.value)}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha de Pago" w={140}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)} />
            </Fld>
            <Fld label="% Descuento" w={100}>
              <input type="number" style={P.inp} value={pDescto} min={0} max={100} onChange={e=>setPDescto(Number(e.target.value))} />
            </Fld>
            <Fld label="% IVA" w={80}>
              <input type="number" style={P.inp} value={pIva} min={0} max={100} onChange={e=>setPIva(Number(e.target.value))} />
            </Fld>
          </div>
          {/* FILA 4: tipo venta, vendedor */}
          <div style={{...P.fila,alignItems:'center'}}>
            {['Mayor','Detal','Vendedor'].map(t=>(
              <label key={t} style={P.radio}>
                <input type="radio" name="tipo" checked={tipoVta===t} onChange={()=>setTipoVta(t)} />
                {' '}{t}
              </label>
            ))}
            <Fld label="Cédula Vendedor" w={130}>
              <input style={P.inp} value={cedVend}
                onChange={e=>setCedVend(e.target.value)}
                onBlur={()=>cargarVendedor(cedVend)} />
            </Fld>
            <Fld label="Nombre Vendedor" w={190}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.nomvended||''} readOnly />
            </Fld>
            <Fld label="Celular Vendedor" w={130}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.celular||''} readOnly />
            </Fld>
          </div>
        </div>

        {/* ── TABLA ARTÍCULOS ── */}
        <div style={{margin:'0 12px 8px'}}>
          <div style={P.tablaWrap}>
            <table style={P.tabla}>
              <thead>
                <tr style={P.thead}>
                  {['Cód. Artículo','Descripción','Talla','Cantidad','$ Unidad','%IVA','$IVA','%Dcto','$Dcto','$ Total',''].map(h=>(
                    <th key={h} style={P.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l,i)=>(
                  <tr key={i} style={{background:i%2===0?'#fff':'#f8faff'}}>
                    <td style={P.td}>
                      <div style={{position:'relative'}}>
                        <input style={{...P.ci,width:80}} value={l.codartic}
                          onChange={e=>buscarArt(e.target.value,i)} placeholder="Código" />
                        {artIdx===i&&artSugg.length>0&&(
                          <ul style={{...P.drop,width:420,zIndex:99}}>
                            {artSugg.map((a,ai)=>(
                              <li key={ai} style={P.dropItem} onClick={()=>elegirArt(a,i)}>
                                <strong>{a.codartic}</strong> · {a.descartic}
                                <span style={{color:'#888',fontSize:10}}> T:{a.talla} ${fmt(a.preciovent)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td style={{...P.td,minWidth:160}}>
                      <input style={{...P.ci,width:'100%'}} value={l.descartic}
                        onChange={e=>buscarDesc(e.target.value,i)} placeholder="Descripción" />
                    </td>
                    <td style={P.td}><input style={{...P.ci,width:46,textAlign:'center'}} value={l.talla} onChange={e=>upd(i,{talla:e.target.value})} /></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:60,textAlign:'right'}} value={l.cantidad} min={0} onChange={e=>upd(i,{cantidad:e.target.value})} /></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:90,textAlign:'right'}} value={l.valunit} min={0} onChange={e=>upd(i,{valunit:Number(e.target.value)})} /></td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porciva} min={0} onChange={e=>upd(i,{porciva:Number(e.target.value)})} /></td>
                    <td style={{...P.td,textAlign:'right',color:'#555',paddingRight:6}}>{l.valiva?fmt(l.valiva):''}</td>
                    <td style={P.td}><input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porcdescue} min={0} max={100} onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} /></td>
                    <td style={{...P.td,textAlign:'right',color:'#c0392b',paddingRight:6}}>{l.valdescue?fmt(l.valdescue):''}</td>
                    <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b',paddingRight:6}}>{l.valtotal?fmt(l.valtotal):''}</td>
                    <td style={{...P.td,textAlign:'center'}}>
                      {l.codartic&&<button onClick={()=>quitarLinea(i)} style={P.btnX}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={P.footer}>
          {/* BOTONES NAVEGACIÓN */}
          <div style={P.footCol}>
            <div style={P.btnFila}>
              <ImgBtn src={IC('wztop')}  onClick={navPrimero}   title="Primero" />
              <ImgBtn src={IC('wzback')} onClick={navAnterior}  title="Anterior" />
              <ImgBtn src={IC('wznext')} onClick={navSiguiente} title="Siguiente" />
              <ImgBtn src={IC('wzend')}  onClick={navUltimo}    title="Último" />
              <ImgBtn src={IC('wzlocate')} onClick={()=>setModal('resumen')} title="Buscar/Resumen" />
            </div>
            <div style={P.btnFila}>
              <ImgBtn src={IC('wznew')}    onClick={nuevaNota} title="Nueva Nota" />
              <ImgBtn src={IC('wzsave')}   onClick={guardar}   title="Guardar" disabled={busy} />
              <ImgBtn src={IC('wzdelete')} onClick={anular}    title="Anular" />
              <ImgBtn src={IC('wzprint')}  onClick={()=>setModal('print')} title="Imprimir" />
              <ImgBtn src={IC('wzclose')}  onClick={onClose}   title="Volver al menú" />
            </div>
          </div>

          {/* TOTALES */}
          <div style={{...P.footCol,flex:1}}>
            <div style={P.prendas}>
              <span style={{fontWeight:700,color:'#856404'}}>CANTIDAD DE PRENDAS</span>
              <span style={{fontSize:24,fontWeight:900,color:'#856404'}}>{prendas}</span>
            </div>
            <div style={P.totGrid}>
              <span style={P.tL}>$ SUBTOTAL</span>
              <span style={P.tL}>$ DESCUENTO</span>
              <span style={P.tL}>$ IVA</span>
              <span style={P.tV}>{fmt(subtotal)}</span>
              <span style={{...P.tV,color:'#c62828'}}>{fmt(totDcto)}</span>
              <span style={P.tV}>{fmt(totIva)}</span>
              <span style={{...P.tL,fontWeight:900,color:'#1a3a6b'}}>$ TOTAL</span>
              <span style={P.tL}>$ ABONO</span>
              <span style={{...P.tL,color:'#c62828'}}>$ SALDO</span>
              <span style={{...P.tV,fontWeight:900,color:'#1a3a6b',fontSize:15}}>{fmt(total)}</span>
              <span style={{...P.tV,color:'#2e7d32'}}>{fmt(abonos)}</span>
              <span style={{...P.tV,color:saldo>0?'#c62828':'#2e7d32',fontWeight:700}}>{fmt(saldo)}</span>
            </div>
          </div>

          {/* MEDIO PAGO + ACCIONES */}
          <div style={P.footCol}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medio===m} onChange={()=>setMedio(m)} />
                  {' '}{m}
                </label>
              ))}
            </div>
            <div style={P.acciones}>
              <BtnAcc onClick={()=>setModal('abonos')}  icon="💵">Abonos</BtnAcc>
              <BtnAcc onClick={()=>setModal('detalle')} icon="🔍">Detalle</BtnAcc>
              <BtnAcc onClick={()=>setModal('resumen')} icon="📊">Resumen</BtnAcc>
              <BtnAcc onClick={()=>setModal('print')}   icon="🖨">Imprimir</BtnAcc>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fld({label,w,children,rel}) {
  return (
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0,position:rel?'relative':undefined}}>
      <span style={{fontSize:10,fontWeight:700,color:'#5577aa',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}

function ImgBtn({src,onClick,title,disabled}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:6,padding:4,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',width:40,height:36}}>
      <img src={src} alt={title} style={{width:28,height:28,objectFit:'contain'}} />
    </button>
  )
}

function BtnAcc({onClick,icon,children}) {
  return (
    <button onClick={onClick} style={{background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700,color:'#1a3a6b',display:'flex',alignItems:'center',gap:4}}>
      <span>{icon}</span>{children}
    </button>
  )
}

const P = {
  pagina:   {minHeight:'100vh',background:'#dde3ee',padding:12},
  ventana:  {background:'#f4f6fb',borderRadius:12,border:'1px solid #c8d5ea',boxShadow:'0 4px 24px rgba(0,0,0,0.12)',maxWidth:1150,margin:'0 auto',overflow:'hidden'},
  titulo:   {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  tituloIzq:{display:'flex',alignItems:'center'},
  tituloCentro:{fontWeight:900,fontSize:16,letterSpacing:2,textAlign:'center',flex:1},
  tituloNro:{background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'4px 14px',fontSize:13,letterSpacing:1,whiteSpace:'nowrap'},
  alerta:   {margin:'8px 12px',padding:'8px 14px',borderRadius:6,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:  {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:14},
  bloque:   {margin:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #e0e7f0',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8},
  fila:     {display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'},
  inp:      {height:26,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 7px',fontSize:12,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:       {background:'#f8faff',color:'#666'},
  radio:    {display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',fontWeight:600,color:'#1a3a6b',marginRight:8},
  drop:     {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',maxHeight:240,overflowY:'auto',minWidth:260},
  dropItem: {padding:'7px 12px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:12},
  tablaWrap:{overflowX:'auto',borderRadius:6,border:'1px solid #e0e7f0',maxHeight:300,overflowY:'auto'},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:11},
  thead:    {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:       {padding:'6px 8px',textAlign:'center',fontWeight:700,color:'#fff',borderRight:'1px solid #2c5fa8',whiteSpace:'nowrap',fontSize:11},
  td:       {padding:'2px 3px',borderRight:'1px solid #e8eef5',borderBottom:'1px solid #e8eef5',verticalAlign:'middle'},
  ci:       {border:'none',background:'transparent',fontSize:11,padding:'2px 4px',outline:'none',color:'#1a3a6b'},
  btnX:     {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:12,fontWeight:700},
  footer:   {display:'flex',gap:12,flexWrap:'wrap',padding:'10px 12px',background:'#eef2ff',borderTop:'2px solid #c8d5ea',alignItems:'flex-start'},
  footCol:  {display:'flex',flexDirection:'column',gap:6},
  btnFila:  {display:'flex',gap:4},
  prendas:  {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'4px 12px',marginBottom:4},
  totGrid:  {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 12px',background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'6px 12px'},
  tL:       {fontSize:10,color:'#5577aa',fontWeight:700,textAlign:'center',textTransform:'uppercase'},
  tV:       {fontSize:12,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  medios:   {display:'flex',flexDirection:'column',gap:5,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 12px'},
  acciones: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:4},
}
