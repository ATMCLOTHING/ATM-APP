// src/components/NotaDeEntrega.jsx
import { useState, useEffect, useRef } from 'react'
import ModalAbonos  from './ModalAbonos'
import ModalResumen from './ModalResumen'
import ModalDetalle from './ModalDetalle'
import PrintNota    from './PrintNota'

const fmt = (n) => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
const hoy = () => new Date().toISOString().slice(0,10)
const VACIA = { codartic:'', descartic:'', talla:'', cantidad:'', valunit:0, porciva:0, valiva:0, porcdescue:0, valdescue:0, valtotal:0 }
const FILAS_VACIAS = () => Array.from({length:12}, () => ({...VACIA}))
const PLAZOS = ['CONTADO','15 DÍAS','30 DÍAS','60 DÍAS','90 DÍAS']
const MEDIOS = ['Efectivo','Transferencia','Mixto','Crédito']

export default function NotaDeEntrega({ supabase, onClose }) {
  const [nroDoc,     setNroDoc]     = useState('')
  const [fecha,      setFecha]      = useState(hoy())
  const [fechaPago,  setFechaPago]  = useState(hoy())
  const [plazoPago,  setPlazoPago]  = useState('CONTADO')
  const [porcDescto, setPorcDescto] = useState(0)
  const [porcIva,    setPorcIva]    = useState(0)
  const [tipoVenta,  setTipoVenta]  = useState('Mayor')
  const [medioPago,  setMedioPago]  = useState('Efectivo')
  const [codCliente, setCodCliente] = useState('99')
  const [clienteTxt, setClienteTxt] = useState('CLIENTE GENERAL')
  const [cliente,    setCliente]    = useState({nombreclie:'CLIENTE GENERAL',ciudad:'MEDELLÍN'})
  const [cliSugg,    setCliSugg]    = useState([])
  const [cedVend,    setCedVend]    = useState('')
  const [vendedor,   setVendedor]   = useState(null)
  const [lineas,     setLineas]     = useState(FILAS_VACIAS())
  const [artSugg,    setArtSugg]    = useState([])
  const [artIdx,     setArtIdx]     = useState(null)
  const [abonos,     setAbonos]     = useState(0)
  const [allIds,     setAllIds]     = useState([])
  const [navPos,     setNavPos]     = useState(null)
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [modal,      setModal]      = useState(null)

  // ── INIT ──
  useEffect(() => { init() }, [])

  async function init() {
    const { data } = await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids = (data||[]).map(r=>r.numnotaent)
    setAllIds(ids)
    const ultimo = ids.length ? Number(ids[ids.length-1]) : 0
    setNroDoc(String(ultimo+1))
    cargarCliente('99')
  }

  // ── CLIENTE ──
  async function cargarCliente(cod) {
    if (!cod) return
    const {data} = await supabase.from('clientes').select('*').eq('codclient',cod).maybeSingle()
    if (data) { setCliente(data); setClienteTxt(data.nombreclie); setCodCliente(data.codclient) }
  }

  async function buscarCliente(txt) {
    setClienteTxt(txt)
    if (txt.length < 2) { setCliSugg([]); return }
    const esNum = /^\d+$/.test(txt)
    const q = supabase.from('clientes').select('codclient,nombreclie,cedrifclie,celular,ciudad,departamen,direcicion,nomempresa')
    const {data} = await (esNum
      ? q.or(`codclient.eq.${txt},cedrifclie.ilike.%${txt}%`)
      : q.ilike('nombreclie',`%${txt}%`)
    ).limit(8)
    setCliSugg(data||[])
  }

  function elegirCliente(c) {
    setCliente(c); setCodCliente(c.codclient); setClienteTxt(c.nombreclie); setCliSugg([])
  }

  // ── VENDEDOR ──
  async function cargarVendedor(ced) {
    if (!ced) return
    const {data} = await supabase.from('vendedor').select('*').eq('cedvended',ced).maybeSingle()
    setVendedor(data||null)
  }

  // ── ARTÍCULOS ──
  async function buscarArt(txt, idx) {
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],codartic:txt}; return n })
    if (txt.length < 2) { setArtSugg([]); setArtIdx(null); return }
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,porciva,existencia')
      .or(`codartic.ilike.%${txt}%,descartic.ilike.%${txt}%`)
      .limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  async function buscarDesc(txt, idx) {
    setLineas(prev => { const n=[...prev]; n[idx]={...n[idx],descartic:txt}; return n })
    if (txt.length < 2) { setArtSugg([]); setArtIdx(null); return }
    const {data} = await supabase.from('articomp')
      .select('codartic,descartic,talla,preciovent,preciovend,porciva,existencia')
      .ilike('descartic',`%${txt}%`)
      .limit(10)
    setArtSugg(data||[]); setArtIdx(idx)
  }

  function elegirArt(art, idx) {
    const precio = tipoVenta==='Vendedor' ? (art.preciovend||art.preciovent) : art.preciovent
    upd(idx, { codartic:art.codartic, descartic:art.descartic, talla:art.talla||'', valunit:precio||0, porciva:art.porciva||0 })
    setArtSugg([]); setArtIdx(null)
  }

  // ── LÍNEAS ──
  function upd(idx, cambios) {
    setLineas(prev => {
      const sig = [...prev]
      const lin = { ...sig[idx], ...cambios }
      const cant = Number(lin.cantidad)||0
      const sub  = cant * (Number(lin.valunit)||0)
      const dcto = sub * ((Number(lin.porcdescue)||0)/100)
      const base = sub - dcto
      const iva  = base * ((Number(lin.porciva)||0)/100)
      lin.valdescue = dcto; lin.valiva = iva; lin.valtotal = base+iva
      sig[idx] = lin
      // agregar fila si es la última y tiene contenido
      if (idx===sig.length-1 && (cambios.codartic||cambios.descartic)) sig.push({...VACIA})
      return sig
    })
  }

  function quitarLinea(idx) {
    setLineas(prev => prev.length>1 ? prev.filter((_,i)=>i!==idx) : prev)
  }

  // ── TOTALES ──
  const detValidas = lineas.filter(l=>l.codartic && Number(l.cantidad)>0)
  const subtotal   = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0)*(Number(l.valunit)||0),0)
  const totDcto    = lineas.reduce((s,l)=>s+(l.valdescue||0),0)
  const totIva     = lineas.reduce((s,l)=>s+(l.valiva||0),0)
  const total      = lineas.reduce((s,l)=>s+(l.valtotal||0),0)
  const saldo      = total - abonos
  const prendas    = lineas.reduce((s,l)=>s+(Number(l.cantidad)||0),0)

  // ── NAVEGACIÓN ──
  async function cargarDoc(id) {
    setBusy(true); setMsg(null)
    const {data:enc} = await supabase.from('encnotaen').select('*').eq('numnotaent',id).maybeSingle()
    if (!enc) { setBusy(false); return }
    setNroDoc(enc.numnotaent)
    setFecha(enc.fechanotae?.slice(0,10)||hoy())
    setFechaPago(enc.fechavence?.slice(0,10)||hoy())
    setPlazoPago(enc.formapago||'CONTADO')
    setMedioPago(enc.mediopago||'Efectivo')
    setPorcDescto(enc.porcdescue||0); setPorcIva(enc.porciva||0)
    setCodCliente(enc.codclient||'99'); setCedVend(enc.cedvended||'')
    if (enc.cedvended) cargarVendedor(enc.cedvended)
    const {data:cli} = await supabase.from('clientes').select('*').eq('codclient',enc.codclient).maybeSingle()
    setCliente(cli||null); setClienteTxt(cli?.nombreclie||enc.nombreclie||'')
    const {data:det} = await supabase.from('detnotaen').select('*').eq('numnotaent',id)
    const filas = det?.length ? [...det, ...Array.from({length:Math.max(0,12-det.length)},()=>({...VACIA}))] : FILAS_VACIAS()
    setLineas(filas)
    const {data:ab} = await supabase.from('detabonos').select('valabono').eq('numnotaent',id)
    setAbonos((ab||[]).reduce((s,r)=>s+(r.valabono||0),0))
    setBusy(false)
  }

  async function recargarIds() {
    const {data} = await supabase.from('encnotaen').select('numnotaent').order('numnotaent',{ascending:true})
    const ids = (data||[]).map(r=>r.numnotaent)
    setAllIds(ids); return ids
  }

  function navPrimero()   { if(allIds.length){ setNavPos(0); cargarDoc(allIds[0]) } }
  function navAnterior()  { const p=navPos??allIds.length; if(p>0){ setNavPos(p-1); cargarDoc(allIds[p-1]) } }
  function navSiguiente() { if(navPos!==null && navPos<allIds.length-1){ setNavPos(navPos+1); cargarDoc(allIds[navPos+1]) } }
  function navUltimo()    { if(allIds.length){ const l=allIds.length-1; setNavPos(l); cargarDoc(allIds[l]) } }

  // ── NUEVA NOTA ──
  async function nuevaNota() {
    const ids = await recargarIds()
    const ultimo = ids.length ? Number(ids[ids.length-1]) : 0
    setNroDoc(String(ultimo+1))
    setFecha(hoy()); setFechaPago(hoy())
    setPlazoPago('CONTADO'); setMedioPago('Efectivo')
    setPorcDescto(0); setPorcIva(0); setTipoVenta('Mayor')
    setCodCliente('99'); setClienteTxt('CLIENTE GENERAL')
    setCliente({nombreclie:'CLIENTE GENERAL',ciudad:'MEDELLÍN'})
    setCedVend(''); setVendedor(null)
    setLineas(FILAS_VACIAS()); setAbonos(0)
    setMsg(null); setNavPos(null)
  }

  // ── GUARDAR ──
  async function guardar() {
    if (!detValidas.length) { setMsg({tipo:'err',texto:'Agrega al menos un artículo con cantidad.'}); return }
    setBusy(true)
    try {
      const enc = {
        numnotaent:nroDoc, fechanotae:fecha, fechavence:fechaPago,
        formapago:plazoPago, mediopago:medioPago,
        codclient:codCliente, nombreclie:cliente?.nombreclie||clienteTxt,
        cedrifclie:cliente?.cedrifclie||'', direcicion:cliente?.direcicion||'',
        celular:cliente?.celular||'', ciudad:cliente?.ciudad||'',
        departamen:cliente?.departamen||'', nomempresa:cliente?.nomempresa||'',
        porcdescue:porcDescto, porciva:porcIva,
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
      setMsg({tipo:'ok',texto:`✅ Nota ${nroDoc} guardada.`})
      const ids = await recargarIds()
      const pos = ids.indexOf(nroDoc)
      if (pos>=0) setNavPos(pos)
    } catch(e) {
      setMsg({tipo:'err',texto:`❌ ${e.message}`})
    }
    setBusy(false)
  }

  // ── ANULAR ──
  async function anular() {
    if (!window.confirm(`¿Anular la nota ${nroDoc}? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    await supabase.from('detnotaen').delete().eq('numnotaent',nroDoc)
    await supabase.from('detabonos').delete().eq('numnotaent',nroDoc)
    await supabase.from('encnotaen').delete().eq('numnotaent',nroDoc)
    setMsg({tipo:'ok',texto:`Nota ${nroDoc} anulada.`})
    setBusy(false)
    nuevaNota()
  }

  const dataNota = { nroDoc,fecha,fechaPago,plazoPago,medioPago,cliente,clienteTxt,codCliente,vendedor,cedVend,lineas:detValidas,subtotal,totDcto,totIva,total,saldo,prendas,abonos }

  return (
    <div style={P.pagina}>
      {modal==='abonos'  && <ModalAbonos  supabase={supabase} nroDoc={nroDoc} totalNota={total} totalAbonos={abonos} onClose={()=>{setModal(null);cargarDoc(nroDoc)}} />}
      {modal==='resumen' && <ModalResumen supabase={supabase} onClose={()=>setModal(null)} />}
      {modal==='detalle' && <ModalDetalle nroDoc={nroDoc} lineas={detValidas} onClose={()=>setModal(null)} />}
      {modal==='print'   && <PrintNota datos={dataNota} onClose={()=>setModal(null)} />}

      <div style={P.ventana}>
        {/* TÍTULO */}
        <div style={P.titulo}>
          <button onClick={onClose} style={P.btnBack}>← Menú</button>
          <div style={P.tituloTexto}>
            <span style={{fontSize:18}}>📋</span>
            <span>NOTA DE ENTREGA</span>
            {busy && <span style={{fontSize:12,opacity:0.7}}>⏳ Cargando…</span>}
          </div>
          <div style={P.nroDoc}>N° {nroDoc}</div>
        </div>

        {/* MENSAJE */}
        {msg && (
          <div style={{...P.alerta, background:msg.tipo==='ok'?'#e8f5e9':'#ffebee', color:msg.tipo==='ok'?'#2e7d32':'#c62828', border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* SECCIÓN CLIENTE */}
        <div style={P.seccion}>
          <div style={P.secTitulo}>👤 CLIENTE</div>
          <div style={P.filaGrid}>
            <Fld label="Código" w={80}>
              <input style={P.inp} value={codCliente}
                onChange={e=>setCodCliente(e.target.value)}
                onBlur={()=>cargarCliente(codCliente)} />
            </Fld>
            <Fld label="Nombre / Razón Social" w={300} rel>
              <input style={P.inp} value={clienteTxt}
                onChange={e=>buscarCliente(e.target.value)}
                placeholder="Buscar por nombre o cédula…" />
              {cliSugg.length>0 && (
                <ul style={P.drop}>
                  {cliSugg.map(c=>(
                    <li key={c.codclient} style={P.dropItem} onClick={()=>elegirCliente(c)}>
                      <strong>{c.codclient}</strong> — {c.nombreclie}
                      {c.cedrifclie && <span style={{color:'#888',fontSize:11}}> · {c.cedrifclie}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Fld>
            <Fld label="Empresa" w={180}>
              <input style={{...P.inp,...P.ro}} value={cliente?.nomempresa||''} readOnly />
            </Fld>
          </div>
          <div style={P.filaGrid}>
            <Fld label="Dirección" w={220}>
              <input style={{...P.inp,...P.ro}} value={cliente?.direcicion||''} readOnly />
            </Fld>
            <Fld label="Celular" w={130}>
              <input style={{...P.inp,...P.ro}} value={cliente?.celular||''} readOnly />
            </Fld>
            <Fld label="Ciudad" w={140}>
              <input style={{...P.inp,...P.ro}} value={cliente?.ciudad||''} readOnly />
            </Fld>
            <Fld label="Depto." w={120}>
              <input style={{...P.inp,...P.ro}} value={cliente?.departamen||''} readOnly />
            </Fld>
          </div>
        </div>

        {/* SECCIÓN FACTURACIÓN */}
        <div style={P.seccion}>
          <div style={P.secTitulo}>🧾 FACTURACIÓN</div>
          <div style={P.filaGrid}>
            <Fld label="Fecha" w={140}>
              <input type="date" style={P.inp} value={fecha} onChange={e=>setFecha(e.target.value)} />
            </Fld>
            <Fld label="Plazo de Pago" w={160}>
              <select style={P.inp} value={plazoPago} onChange={e=>setPlazoPago(e.target.value)}>
                {PLAZOS.map(p=><option key={p}>{p}</option>)}
              </select>
            </Fld>
            <Fld label="Fecha de Pago" w={140}>
              <input type="date" style={P.inp} value={fechaPago} onChange={e=>setFechaPago(e.target.value)} />
            </Fld>
            <Fld label="% Descuento" w={100}>
              <input type="number" style={P.inp} value={porcDescto} min={0} max={100}
                onChange={e=>setPorcDescto(Number(e.target.value))} />
            </Fld>
            <Fld label="% IVA" w={80}>
              <input type="number" style={P.inp} value={porcIva} min={0} max={100}
                onChange={e=>setPorcIva(Number(e.target.value))} />
            </Fld>
          </div>
          <div style={{...P.filaGrid, alignItems:'center', gap:16, marginTop:4}}>
            <div style={{display:'flex',gap:16}}>
              {['Mayor','Detal','Vendedor'].map(t=>(
                <label key={t} style={P.radio}>
                  <input type="radio" name="tipo" checked={tipoVenta===t} onChange={()=>setTipoVenta(t)} />
                  {' '}{t}
                </label>
              ))}
            </div>
            <Fld label="Cédula Vendedor" w={130}>
              <input style={P.inp} value={cedVend}
                onChange={e=>setCedVend(e.target.value)}
                onBlur={()=>cargarVendedor(cedVend)} />
            </Fld>
            <Fld label="Nombre Vendedor" w={180}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.nomvended||''} readOnly />
            </Fld>
            <Fld label="Celular Vendedor" w={130}>
              <input style={{...P.inp,...P.ro}} value={vendedor?.celular||''} readOnly />
            </Fld>
          </div>
        </div>

        {/* TABLA ARTÍCULOS */}
        <div style={P.seccion}>
          <div style={P.secTitulo}>📦 ARTÍCULOS</div>
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
                  <tr key={i} style={{background: i%2===0?'#fff':'#f8faff'}}>
                    <td style={P.td}>
                      <div style={{position:'relative'}}>
                        <input style={{...P.ci,width:80}} value={l.codartic}
                          onChange={e=>buscarArt(e.target.value,i)}
                          placeholder="Código" />
                        {artIdx===i && artSugg.length>0 && (
                          <ul style={{...P.drop,width:400,zIndex:99}}>
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
                        onChange={e=>buscarDesc(e.target.value,i)}
                        placeholder="Descripción" />
                    </td>
                    <td style={P.td}>
                      <input style={{...P.ci,width:46,textAlign:'center'}} value={l.talla}
                        onChange={e=>upd(i,{talla:e.target.value})} />
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:60,textAlign:'right'}} value={l.cantidad} min={0}
                        onChange={e=>upd(i,{cantidad:e.target.value})} />
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:90,textAlign:'right'}} value={l.valunit} min={0}
                        onChange={e=>upd(i,{valunit:Number(e.target.value)})} />
                    </td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porciva} min={0}
                        onChange={e=>upd(i,{porciva:Number(e.target.value)})} />
                    </td>
                    <td style={{...P.td,textAlign:'right',color:'#555',paddingRight:6}}>{l.valiva?fmt(l.valiva):''}</td>
                    <td style={P.td}>
                      <input type="number" style={{...P.ci,width:46,textAlign:'right'}} value={l.porcdescue} min={0} max={100}
                        onChange={e=>upd(i,{porcdescue:Number(e.target.value)})} />
                    </td>
                    <td style={{...P.td,textAlign:'right',color:'#c0392b',paddingRight:6}}>{l.valdescue?fmt(l.valdescue):''}</td>
                    <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b',paddingRight:6}}>{l.valtotal?fmt(l.valtotal):''}</td>
                    <td style={{...P.td,textAlign:'center'}}>
                      {l.codartic && (
                        <button onClick={()=>quitarLinea(i)} style={P.btnX} title="Quitar">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div style={P.footer}>
          {/* NAVEGACIÓN + CRUD */}
          <div style={P.footBloque}>
            <div style={P.navFila}>
              <BtnNav onClick={navPrimero}  t="Primero">⏮</BtnNav>
              <BtnNav onClick={navAnterior} t="Anterior">◀</BtnNav>
              <BtnNav onClick={navSiguiente}t="Siguiente">▶</BtnNav>
              <BtnNav onClick={navUltimo}   t="Último">⏭</BtnNav>
              <BtnNav onClick={()=>setModal('print')} t="Imprimir">🖨</BtnNav>
            </div>
            <div style={P.navFila}>
              <BtnNav onClick={nuevaNota} t="Nueva Nota"  color="#2e7d32">+</BtnNav>
              <BtnNav onClick={guardar}   t="Guardar"     color="#1a3a6b" disabled={busy}>{busy?'⏳':'💾'}</BtnNav>
              <BtnNav onClick={anular}    t="Anular nota" color="#c62828">🗑</BtnNav>
            </div>
          </div>

          {/* TOTALES */}
          <div style={P.footBloque}>
            <div style={P.prendas}>
              <span>CANTIDAD DE PRENDAS</span>
              <span style={{fontSize:22,fontWeight:900}}>{prendas}</span>
            </div>
            <div style={P.totGrid}>
              <span style={P.tLbl}>$ SUBTOTAL</span>
              <span style={P.tLbl}>$ DESCUENTO</span>
              <span style={P.tLbl}>$ IVA</span>
              <span style={P.tVal}>{fmt(subtotal)}</span>
              <span style={{...P.tVal,color:'#c62828'}}>{fmt(totDcto)}</span>
              <span style={P.tVal}>{fmt(totIva)}</span>
              <span style={{...P.tLbl,fontWeight:900,color:'#1a3a6b'}}>$ TOTAL</span>
              <span style={P.tLbl}>$ ABONO</span>
              <span style={{...P.tLbl,color:'#c62828'}}>$ SALDO</span>
              <span style={{...P.tVal,fontWeight:900,color:'#1a3a6b',fontSize:14}}>{fmt(total)}</span>
              <span style={{...P.tVal,color:'#2e7d32'}}>{fmt(abonos)}</span>
              <span style={{...P.tVal,color:saldo>0?'#c62828':'#2e7d32',fontWeight:700}}>{fmt(saldo)}</span>
            </div>
          </div>

          {/* MEDIO PAGO + ACCIONES */}
          <div style={P.footBloque}>
            <div style={P.medios}>
              {MEDIOS.map(m=>(
                <label key={m} style={P.radio}>
                  <input type="radio" name="medio" checked={medioPago===m} onChange={()=>setMedioPago(m)} />
                  {' '}{m}
                </label>
              ))}
            </div>
            <div style={P.acciones}>
              <BtnAcc onClick={()=>setModal('abonos')}  icon="💵">Abonos</BtnAcc>
              <BtnAcc onClick={()=>setModal('resumen')} icon="📊">Resumen</BtnAcc>
              <BtnAcc onClick={()=>setModal('detalle')} icon="🔍">Detalle</BtnAcc>
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

function BtnNav({onClick,t,children,color,disabled}) {
  return (
    <button onClick={onClick} title={t} disabled={disabled} style={{
      width:40,height:40,border:`1px solid ${color||'#c8d5ea'}`,borderRadius:8,
      background:color||'#eef2ff',color:color?'#fff':'#1a3a6b',
      cursor:disabled?'not-allowed':'pointer',fontWeight:700,fontSize:15,
      display:'flex',alignItems:'center',justifyContent:'center',
      opacity:disabled?0.5:1,
    }}>{children}</button>
  )
}

function BtnAcc({onClick,icon,children}) {
  return (
    <button onClick={onClick} style={{
      background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:8,
      padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700,
      color:'#1a3a6b',display:'flex',alignItems:'center',gap:4,
    }}><span>{icon}</span>{children}</button>
  )
}

const P = {
  pagina:   {minHeight:'100vh',background:'#dde3ee',padding:12},
  ventana:  {background:'#f4f6fb',borderRadius:12,border:'1px solid #c8d5ea',boxShadow:'0 4px 24px rgba(0,0,0,0.12)',maxWidth:1150,margin:'0 auto',overflow:'hidden'},
  titulo:   {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  btnBack:  {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  tituloTexto:{display:'flex',alignItems:'center',gap:8,fontWeight:800,fontSize:14,letterSpacing:1},
  nroDoc:   {background:'rgba(255,255,255,0.2)',borderRadius:6,padding:'4px 14px',fontWeight:900,fontSize:16,letterSpacing:1},
  alerta:   {margin:'8px 12px',padding:'8px 14px',borderRadius:6,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:  {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:14},
  seccion:  {margin:'8px 12px',background:'#fff',borderRadius:8,border:'1px solid #e0e7f0',padding:'10px 14px'},
  secTitulo:{fontSize:11,fontWeight:800,color:'#5577aa',textTransform:'uppercase',letterSpacing:1,marginBottom:8,borderBottom:'1px solid #eef0f5',paddingBottom:4},
  filaGrid: {display:'flex',flexWrap:'wrap',gap:8,marginBottom:6},
  inp:      {height:26,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 7px',fontSize:12,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b'},
  ro:       {background:'#f8faff',color:'#666'},
  radio:    {display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',fontWeight:600,color:'#1a3a6b'},
  drop:     {position:'absolute',top:'100%',left:0,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,listStyle:'none',margin:0,padding:0,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.15)',maxHeight:240,overflowY:'auto',minWidth:260},
  dropItem: {padding:'7px 12px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:12,transition:'background 0.1s'},
  tablaWrap:{overflowX:'auto',borderRadius:6,border:'1px solid #e0e7f0',maxHeight:320,overflowY:'auto'},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:11},
  thead:    {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:       {padding:'6px 8px',textAlign:'center',fontWeight:700,color:'#fff',borderRight:'1px solid #2c5fa8',whiteSpace:'nowrap',fontSize:11},
  td:       {padding:'2px 3px',borderRight:'1px solid #e8eef5',borderBottom:'1px solid #e8eef5',verticalAlign:'middle'},
  ci:       {border:'none',background:'transparent',fontSize:11,padding:'2px 4px',outline:'none',color:'#1a3a6b'},
  btnX:     {background:'none',border:'none',color:'#c0392b',cursor:'pointer',fontSize:12,fontWeight:700},
  footer:   {display:'flex',gap:10,flexWrap:'wrap',padding:'10px 12px',background:'#eef2ff',borderTop:'2px solid #c8d5ea'},
  footBloque:{display:'flex',flexDirection:'column',gap:6},
  navFila:  {display:'flex',gap:4},
  prendas:  {display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff3cd',border:'1px solid #ffc107',borderRadius:6,padding:'4px 12px',fontWeight:700,color:'#856404',fontSize:12,marginBottom:4},
  totGrid:  {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'2px 12px',background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'6px 12px',flex:1},
  tLbl:     {fontSize:10,color:'#5577aa',fontWeight:700,textAlign:'center',textTransform:'uppercase'},
  tVal:     {fontSize:12,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#333'},
  medios:   {display:'flex',flexDirection:'column',gap:5,background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 12px'},
  acciones: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:4},
}
