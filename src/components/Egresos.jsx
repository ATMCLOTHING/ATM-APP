// src/components/Egresos.jsx
import { useState, useEffect, useRef } from 'react'
import { fmtFecha } from '../lib/fecha'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0})
const fmtM = n => '$'+fmt(n)
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const mes1 = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01' }

const TIPOS_TERCERO = ['GENERAL','PROVEEDOR','EMPLEADO','ENTIDAD BANCARIA','ENTIDAD PÚBLICA','ARRENDADOR','OTRO']
const MEDIO_PAGO    = ['EFECTIVO','TRANSFERENCIA','CONSIGNACIÓN']

const FORM_VACIO = {
  tipoegreso:'', egr_detalle_id:'', fechapag:hoy(),
  tercero_id:'', nomrazben:'', subdetalle:'',
  perdesde:'', perhasta:'', valorneto:'',
  valrecarg:'0', valdescue:'0', mediopago:'EFECTIVO', observacio:'',
}

export default function Egresos({ supabase, usuario, onClose }) {
  const [tab,       setTab]       = useState('registrar')
  const [grupos,    setGrupos]    = useState([])
  const [detalles,  setDetalles]  = useState([])
  const [terceros,  setTerceros]  = useState([])
  const [egresos,   setEgresos]   = useState([])
  const [cargando,  setCargando]  = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [form,      setForm]      = useState({...FORM_VACIO})
  const [editId,    setEditId]    = useState(null)
  const [filtDesde, setFiltDesde] = useState(mes1())
  const [filtHasta, setFiltHasta] = useState(hoy())
  const [filtGrupo, setFiltGrupo] = useState('')
  const [filtMedio, setFiltMedio] = useState('')
  // búsqueda de tercero
  const [busqTerc,  setBusqTerc]  = useState('')
  const [showTerc,  setShowTerc]  = useState(false)
  const tercRef = useRef(null)

  useEffect(() => { cargarMaestros() }, [])
  useEffect(() => {
    function click(e) { if (tercRef.current && !tercRef.current.contains(e.target)) setShowTerc(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  async function cargarMaestros() {
    const [{ data: g }, { data: d }, { data: t }] = await Promise.all([
      supabase.from('egr_grupos').select('id,nombre').order('nombre'),
      supabase.from('egr_detalles').select('id,grupo_id,nombre').eq('activo', true).order('nombre'),
      supabase.from('terceros').select('*').eq('activo', true).order('nombre'),
    ])
    setGrupos(g || [])
    setDetalles(d || [])
    setTerceros(t || [])
  }

  const detFiltrados = detalles.filter(d => String(d.grupo_id) === String(form.tipoegreso))

  function setF(k, v) {
    setForm(prev => {
      const n = { ...prev, [k]: v }
      if (k === 'tipoegreso') n.egr_detalle_id = ''
      return n
    })
  }

  function elegirTercero(t) {
    setForm(p => ({ ...p, tercero_id: t.id||t.cedrif, nomrazben: t.nomtercero||t.nombre }))
    setBusqTerc(t.nomtercero||t.nombre)
    setShowTerc(false)
  }

  function limpiarTercero() {
    setForm(p => ({ ...p, tercero_id: '', nomrazben: '' }))
    setBusqTerc('')
  }

  const valtotal = () => Number(form.valorneto||0) + Number(form.valrecarg||0) - Number(form.valdescue||0)

  async function guardar() {
    setMsg(null)
    if (!form.tipoegreso)  return setMsg({ ok:false, txt:'Selecciona el tipo de egreso.' })
    if (!form.fechapag)    return setMsg({ ok:false, txt:'Ingresa la fecha de pago.' })
    if (!form.nomrazben)   return setMsg({ ok:false, txt:'Selecciona o ingresa el beneficiario.' })
    if (!form.valorneto || Number(form.valorneto) <= 0)
                           return setMsg({ ok:false, txt:'Ingresa un valor válido.' })
    setGuardando(true)
    const reg = {
      grupo_id:       Number(form.tipoegreso),
      egr_detalle_id: form.egr_detalle_id ? Number(form.egr_detalle_id) : null,
      fecha_pago:     form.fechapag,
      cedrif_benef:   form.tercero_id ? String(form.tercero_id) : null,
      nombre_benef:   form.nomrazben,
      subdetalle:     form.subdetalle || null,
      per_desde:      form.perdesde || null,
      per_hasta:      form.perhasta || null,
      subtotal:       Number(form.valorneto),
      recargos:       Number(form.valrecarg||0),
      descuento:      Number(form.valdescue||0),
      total:          valtotal(),
      medio_pago:     form.mediopago,
      observaciones:  form.observacio || null,
      usuario:        usuario?.usuario || 'admin',
    }
    let error
    if (editId) {
      const { usuario, ...regSinUsuario } = reg
      ;({ error } = await supabase.from('egresos').update(regSinUsuario).eq('id', editId))
    } else {
      ({ error } = await supabase.from('egresos').insert(reg))
    }
    if (error) { setMsg({ ok:false, txt:'Error: ' + error.message }) }
    else {
      setMsg({ ok:true, txt: editId ? `✅ Egreso actualizado — ${fmtM(valtotal())}` : `✅ Egreso registrado — ${fmtM(valtotal())}` })
      const veniaDeEditar = !!editId
      setForm({ ...FORM_VACIO })
      setBusqTerc('')
      setEditId(null)
      if (veniaDeEditar) { setTab('consultar'); consultar() }
    }
    setGuardando(false)
  }

  function editarEgreso(e) {
    setEditId(e.id)
    setForm({
      tipoegreso:     e.grupo_id!=null ? String(e.grupo_id) : '',
      egr_detalle_id: e.egr_detalle_id!=null ? String(e.egr_detalle_id) : '',
      fechapag:       e.fecha_pago || hoy(),
      tercero_id:     e.cedrif_benef || '',
      nomrazben:      e.nombre_benef || '',
      subdetalle:     e.subdetalle || '',
      perdesde:       e.per_desde || '',
      perhasta:       e.per_hasta || '',
      valorneto:      e.subtotal!=null ? String(e.subtotal) : '',
      valrecarg:      e.recargos!=null ? String(e.recargos) : '0',
      valdescue:      e.descuento!=null ? String(e.descuento) : '0',
      mediopago:      e.medio_pago || 'EFECTIVO',
      observacio:     e.observaciones || '',
    })
    setBusqTerc(e.nombre_benef || '')
    setMsg(null)
    setTab('registrar')
  }

  function cancelarEdicion() {
    setForm({ ...FORM_VACIO }); setBusqTerc(''); setMsg(null); setEditId(null)
  }

  async function consultar() {
    setCargando(true)
    let q = supabase.from('egresos').select('*')
      .gte('fecha_pago', filtDesde).lte('fecha_pago', filtHasta)
      .order('fecha_pago', { ascending:false })
    if (filtGrupo) q = q.eq('grupo_id', Number(filtGrupo))
    if (filtMedio) q = q.eq('medio_pago', filtMedio)
    const { data } = await q.limit(2000)
    setEgresos(data || [])
    setCargando(false)
  }

  const totalEgresos = egresos.reduce((s,e) => s+(e.total||0), 0)
  const tercFiltrados = terceros.filter(t =>
    !busqTerc || (t.nomtercero||t.nombre||'').toLowerCase().includes(busqTerc.toLowerCase()) ||
    (t.cedrif||'').includes(busqTerc)
  ).slice(0, 20)

  function imprimirEgresos() {
    const w = window.open('','_blank','width=1000,height=700')
    w.document.write(`<html><head><meta charset="UTF-8"><title>Egresos</title>
    <style>@page{size:letter landscape;margin:10mm;}body{font-family:Arial,sans-serif;font-size:11px;margin:20px;}
    h2{color:#1a3a6b;text-align:center;}.sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;margin-bottom:18px;}
    th{background:#1a3a6b;color:#fff;padding:5px 8px;font-size:10px;}
    td{padding:4px 8px;border-bottom:1px solid #eee;font-size:10px;}
    .tot{font-weight:900;background:#dde3ee;}
    @media print{body{margin:8px;}}</style></head><body>
    <h2>ATM — EGRESOS</h2>
    <div class="sub">Del ${fmtFecha(filtDesde)} al ${fmtFecha(filtHasta)}</div>
    <table><thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Beneficiario</th><th>Subdetalle</th>
      <th style="text-align:right">Total</th><th>Medio</th>
    </tr></thead><tbody>
    ${egresos.map(e=>`<tr>
      <td>${fmtFecha(e.fecha_pago)}</td>
      <td>${grupos.find(g=>g.id===e.grupo_id)?.nombre||e.grupo_id}</td>
      <td>${e.nombre_benef||''}</td>
      <td>${e.subdetalle||''}</td>
      <td style="text-align:right">${fmtM(e.total)}</td>
      <td>${e.medio_pago||''}</td>
    </tr>`).join('')}
    <tr class="tot"><td colspan="4"><b>TOTAL</b></td>
    <td style="text-align:right"><b>${fmtM(totalEgresos)}</b></td><td></td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  const S = estilos

  return (
    <div style={S.pag}>
      {/* ── Header ── */}
      <div style={S.head}>
        <span style={S.hTit}><span style={{fontSize:20}}>💸</span> CONTROL DE EGRESOS</span>
        <div style={{ display:'flex', gap:8 }}>
          <TabBtn id="registrar" cur={tab} set={setTab} label="+ Registrar Egreso"/>
          <TabBtn id="consultar" cur={tab} set={setTab} icon="🔍" label="Consultar / Imprimir"/>
          <TabBtn id="resumen"   cur={tab} set={setTab} icon="📊" label="Resumen por Categoría"/>
          <TabBtn id="tipos"     cur={tab} set={setTab} icon="⚙️" label="Tipos"/>
          <TabBtn id="terceros_tab" cur={tab} set={setTab} icon="👥" label="Terceros"/>
        </div>
        <button onClick={onClose} style={S.btnClose}>← Menú</button>
      </div>

      {msg && <div style={{ ...S.alerta, background:msg.ok?'#e8f5e9':'#ffebee', color:msg.ok?'#2e7d32':'#c62828', border:`1px solid ${msg.ok?'#a5d6a7':'#ef9a9a'}` }}>
        {msg.txt} <button onClick={()=>setMsg(null)} style={S.alertaX}>✕</button>
      </div>}

      <div style={S.cuerpo}>

        {/* ══ TAB REGISTRAR ══ */}
        {tab==='registrar' && (
          <div style={S.tarjeta}>
            <div style={S.secTit}>
              {editId
                ? <><span style={{fontSize:18}}>✏️</span> Editar Egreso #{editId}</>
                : <><span style={{fontSize:18}}>📝</span> Nuevo Egreso</>}
            </div>
            <div style={S.fila}>
              <Campo label="Tipo de Egreso *" w={260}>
                <select style={S.inp} value={form.tipoegreso} onChange={e=>setF('tipoegreso',e.target.value)}>
                  <option value="">-- Selecciona --</option>
                  {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </Campo>
              {form.tipoegreso && detFiltrados.length > 0 && (
                <Campo label="Detalle" w={280}>
                  <select style={S.inp} value={form.egr_detalle_id} onChange={e=>setF('egr_detalle_id',e.target.value)}>
                    <option value="">-- Selecciona detalle --</option>
                    {detFiltrados.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </Campo>
              )}
              <Campo label="Subdetalle / Descripción">
                <input style={S.inp} value={form.subdetalle} onChange={e=>setF('subdetalle',e.target.value)}
                  placeholder="Descripción adicional (opcional)"/>
              </Campo>
            </div>

            <div style={S.fila}>
              {/* Selector de tercero */}
              <Campo label="Beneficiario *" w={340}>
                <div ref={tercRef} style={{ position:'relative' }}>
                  <div style={{ display:'flex', gap:3 }}>
                    <input style={{...S.inp, flex:1}} value={busqTerc}
                      onChange={e=>{ setBusqTerc(e.target.value); setShowTerc(true); if(!e.target.value) limpiarTercero() }}
                      onFocus={()=>setShowTerc(true)}
                      placeholder="Busca por nombre o cédula…"/>
                    {busqTerc && <button onClick={limpiarTercero} style={{...S.inp,width:26,padding:0,cursor:'pointer',textAlign:'center',background:'#fdecea',color:'#c62828',fontWeight:900,fontSize:16,flexShrink:0}}>✕</button>}
                  </div>
                  {showTerc && (
                    <div style={S.drop}>
                      <div style={{padding:'4px 8px',fontSize:11,color:'#888',borderBottom:'1px solid #eee'}}>
                        {tercFiltrados.length} resultado(s)
                      </div>
                      {tercFiltrados.map(t=>(
                        <div key={t.id||t.cedrif} onClick={()=>elegirTercero(t)} style={S.dropItem}>
                          <strong style={{color:'#1a3a6b'}}>{t.nomtercero||t.nombre}</strong>
                          {t.cedrif && <span style={{color:'#888',fontSize:11}}> · {t.cedrif}</span>}
                          {t.tipo_tercero && <span style={{fontSize:10,color:'#aaa'}}> ({t.tipo_tercero})</span>}
                        </div>
                      ))}
                      <div onClick={()=>{ setTab('terceros_tab'); setShowTerc(false) }}
                        style={{...S.dropItem, color:'#1a3a6b', fontWeight:700, borderTop:'1px solid #eee'}}>
                        <span style={{fontSize:16}}>➕</span> Crear nuevo tercero
                      </div>
                    </div>
                  )}
                </div>
              </Campo>
              <Campo label="Fecha de Pago *" w={150}>
                <input type="date" style={S.inp} value={form.fechapag} onChange={e=>setF('fechapag',e.target.value)}/>
              </Campo>
              <Campo label="Medio de Pago *" w={180}>
                <select style={S.inp} value={form.mediopago} onChange={e=>setF('mediopago',e.target.value)}>
                  {MEDIO_PAGO.map(m=><option key={m}>{m}</option>)}
                </select>
              </Campo>
            </div>

            <div style={S.fila}>
              <Campo label="Período Desde" w={150}>
                <input type="date" style={S.inp} value={form.perdesde} onChange={e=>setF('perdesde',e.target.value)}/>
              </Campo>
              <Campo label="Período Hasta" w={150}>
                <input type="date" style={S.inp} value={form.perhasta} onChange={e=>setF('perhasta',e.target.value)}/>
              </Campo>
              <Campo label="Valor Neto *" w={160}>
                <input type="number" style={S.inp} value={form.valorneto} min={0}
                  onChange={e=>setF('valorneto',e.target.value)} placeholder="0"/>
              </Campo>
              <Campo label="Recargo" w={120}>
                <input type="number" style={S.inp} value={form.valrecarg} min={0}
                  onChange={e=>setF('valrecarg',e.target.value)}/>
              </Campo>
              <Campo label="Descuento" w={120}>
                <input type="number" style={S.inp} value={form.valdescue} min={0}
                  onChange={e=>setF('valdescue',e.target.value)}/>
              </Campo>
            </div>

            <Campo label="Observación">
              <input style={S.inp} value={form.observacio} onChange={e=>setF('observacio',e.target.value)}
                placeholder="Observación opcional"/>
            </Campo>

            <div style={{...S.fila, alignItems:'center', marginTop:12, background:'#fff8e1', border:'1px solid #ffe082', borderRadius:6, padding:'10px 14px'}}>
              <span style={{fontSize:13,fontWeight:700,color:'#333'}}>TOTAL A PAGAR</span>
              <span style={{fontSize:22,fontWeight:900,color:'#1a3a6b'}}>{fmtM(valtotal())}</span>
              <button onClick={guardar} disabled={guardando} style={S.btnGuardar}>
                <span style={{fontSize:16}}>💾</span> {guardando?'Guardando…':(editId?'Actualizar Egreso':'Guardar Egreso')}
              </button>
              <button onClick={cancelarEdicion} style={S.btnLimpiar}>
                <span style={{fontSize:16}}>🧹</span> {editId?'Cancelar edición':'Limpiar'}
              </button>
            </div>
          </div>
        )}

        {/* ══ TAB CONSULTAR ══ */}
        {tab==='consultar' && (
          <div style={S.tarjeta}>
            <div style={{...S.fila, marginBottom:12}}>
              <Campo label="Desde" w={150}><input type="date" style={S.inp} value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}/></Campo>
              <Campo label="Hasta" w={150}><input type="date" style={S.inp} value={filtHasta} onChange={e=>setFiltHasta(e.target.value)}/></Campo>
              <Campo label="Tipo" w={200}>
                <select style={S.inp} value={filtGrupo} onChange={e=>setFiltGrupo(e.target.value)}>
                  <option value="">Todos</option>
                  {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Medio" w={160}>
                <select style={S.inp} value={filtMedio} onChange={e=>setFiltMedio(e.target.value)}>
                  <option value="">Todos</option>
                  {MEDIO_PAGO.map(m=><option key={m}>{m}</option>)}
                </select>
              </Campo>
              <button onClick={consultar} disabled={cargando} style={S.btnBuscar}>
                {cargando?<><span style={{fontSize:16}}>⏳</span> Cargando…</>:<><span style={{fontSize:16}}>🔍</span> Consultar</>}
              </button>
              {egresos.length>0 && <button onClick={imprimirEgresos} style={S.btnPrint}><span style={{fontSize:16}}>🖨</span> Imprimir</button>}
            </div>
            {egresos.length > 0 && (
              <div style={{marginBottom:10,display:'flex',gap:16,fontSize:12,fontWeight:700}}>
                <span>Total: <strong style={{color:'#1a3a6b'}}>{fmtM(totalEgresos)}</strong></span>
                <span>Efectivo: <strong>{fmtM(egresos.filter(e=>e.medio_pago==='EFECTIVO').reduce((s,e)=>s+(e.total||0),0))}</strong></span>
                <span>Transferencia: <strong>{fmtM(egresos.filter(e=>e.medio_pago==='TRANSFERENCIA').reduce((s,e)=>s+(e.total||0),0))}</strong></span>
                <span style={{color:'#888'}}>{egresos.length} registros</span>
              </div>
            )}
            <div style={{overflowX:'auto'}}>
              <table style={S.tabla}>
                <thead><tr style={S.thead}>
                  {['Fecha','Tipo','Detalle','Beneficiario','Observación','Total','Medio','Usuario',''].map(h=>(
                    <th key={h} style={{...S.th,textAlign:h==='Total'?'right':'left'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {egresos.map((e,i)=>(
                    <tr key={e.id} style={{background:i%2===0?'#fff':'#f5f7fc',fontSize:12}}>
                      <td style={S.td}>{fmtFecha(e.fecha_pago)}</td>
                      <td style={S.td}>{grupos.find(g=>g.id===e.grupo_id)?.nombre||e.grupo_id}</td>
                      <td style={S.td}>{detalles.find(d=>d.id===e.egr_detalle_id)?.nombre||e.subdetalle||''}</td>
                      <td style={S.td}>{e.nombre_benef}</td>
                      <td style={S.td}>{e.observaciones||''}</td>
                      <td style={{...S.td,textAlign:'right',fontWeight:700}}>{fmtM(e.total)}</td>
                      <td style={S.td}>{e.medio_pago}</td>
                      <td style={{...S.td,color:'#888'}}>{e.usuario}</td>
                      <td style={S.td}>
                        <button onClick={()=>editarEgreso(e)} title="Editar egreso"
                          style={{background:'none',border:'none',cursor:'pointer',fontSize:15}}>✏️</button>
                      </td>
                    </tr>
                  ))}
                  {egresos.length===0&&!cargando&&<tr><td colSpan={9} style={{textAlign:'center',padding:20,color:'#aaa'}}>Sin registros en este período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB RESUMEN ══ */}
        {tab==='resumen' && (
          <div style={S.tarjeta}>
            <div style={{...S.fila,marginBottom:12}}>
              <Campo label="Desde" w={150}><input type="date" style={S.inp} value={filtDesde} onChange={e=>setFiltDesde(e.target.value)}/></Campo>
              <Campo label="Hasta" w={150}><input type="date" style={S.inp} value={filtHasta} onChange={e=>setFiltHasta(e.target.value)}/></Campo>
              <button onClick={consultar} disabled={cargando} style={S.btnBuscar}>{cargando?<span style={{fontSize:16}}>⏳</span>:<><span style={{fontSize:16}}>🔍</span> Consultar</>}</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
              {grupos.filter(g=>{
                const tot=egresos.filter(e=>e.grupo_id===g.id).reduce((s,e)=>s+(e.total||0),0)
                return tot>0
              }).sort((a,b)=>{
                const ta=egresos.filter(e=>e.grupo_id===a.id).reduce((s,e)=>s+(e.total||0),0)
                const tb=egresos.filter(e=>e.grupo_id===b.id).reduce((s,e)=>s+(e.total||0),0)
                return tb-ta
              }).map(g=>{
                const tot=egresos.filter(e=>e.grupo_id===g.id).reduce((s,e)=>s+(e.total||0),0)
                const pct=totalEgresos>0?Math.round(tot/totalEgresos*100):0
                return (
                  <div key={g.id} style={{background:'#fff',border:'1px solid #e0e7f0',borderRadius:8,padding:'12px 14px'}}>
                    <div style={{fontSize:13,fontWeight:800,color:'#1a3a6b'}}>{g.nombre}</div>
                    <div style={{fontSize:20,fontWeight:900,margin:'4px 0'}}>{fmtM(tot)}</div>
                    <div style={{fontSize:11,color:'#888'}}>{pct}% del total · {egresos.filter(e=>e.grupo_id===g.id).length} registros</div>
                  </div>
                )
              })}
            </div>
            {totalEgresos>0&&<div style={{marginTop:14,fontWeight:900,fontSize:14,color:'#1a3a6b'}}>TOTAL EGRESOS: {fmtM(totalEgresos)}</div>}
          </div>
        )}

        {/* ══ TAB TIPOS ══ */}
        {tab==='tipos' && <GestionTipos supabase={supabase} grupos={grupos} detalles={detalles} onRecargar={cargarMaestros}/>}

        {/* ══ TAB TERCEROS ══ */}
        {tab==='terceros_tab' && <GestionTerceros supabase={supabase} terceros={terceros} onRecargar={cargarMaestros}/>}

      </div>
    </div>
  )
}

// ── Gestión de Tipos y Detalles ──────────────────────────────────────────
function GestionTipos({ supabase, grupos, detalles, onRecargar }) {
  const [grupoSel, setGrupoSel] = useState(null)
  const [nuevoGrupo, setNuevoGrupo] = useState('')
  const [nuevoDet, setNuevoDet] = useState('')
  const [msg, setMsg] = useState(null)
  const S = estilos

  const detDelGrupo = detalles.filter(d => d.grupo_id === grupoSel?.id)

  async function crearGrupo() {
    if (!nuevoGrupo.trim()) return
    const {error} = await supabase.from('egr_grupos').insert({nombre: nuevoGrupo.trim(), cg: 0})
    if (error) { setMsg({ok:false,txt:error.message}); return }
    setNuevoGrupo(''); onRecargar()
  }

  async function eliminarGrupo(g) {
    if (!window.confirm(`¿Eliminar el tipo "${g.nombre}"? Se eliminarán también sus detalles.`)) return
    await supabase.from('egr_grupos').delete().eq('id', g.id)
    if (grupoSel?.id===g.id) setGrupoSel(null)
    onRecargar()
  }

  async function crearDetalle() {
    if (!nuevoDet.trim() || !grupoSel) return
    const {error} = await supabase.from('egr_detalles').insert({grupo_id: grupoSel.id, nombre: nuevoDet.trim()})
    if (error) { setMsg({ok:false,txt:error.message}); return }
    setNuevoDet(''); onRecargar()
  }

  async function eliminarDetalle(d) {
    await supabase.from('egr_detalles').update({activo:false}).eq('id', d.id)
    onRecargar()
  }

  return (
    <div style={{display:'flex',gap:16}}>
      <div style={{...S.tarjeta, width:340, flexShrink:0}}>
        <div style={S.secTit}><span style={{fontSize:18}}>📋</span> Tipos de Egreso</div>
        {msg&&<div style={{...S.alerta,background:msg.ok?'#e8f5e9':'#ffebee',color:msg.ok?'#2e7d32':'#c62828',marginBottom:8}}>{msg.txt}</div>}
        <div style={{display:'flex',gap:6,marginBottom:10}}>
          <input style={{...S.inp,flex:1}} value={nuevoGrupo} onChange={e=>setNuevoGrupo(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&crearGrupo()} placeholder="Nombre del tipo…"/>
          <button onClick={crearGrupo} style={S.btnGuardar}><span style={{fontSize:16}}>➕</span> Agregar</button>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          {grupos.map(g=>(
            <div key={g.id} onClick={()=>setGrupoSel(g)}
              style={{...S.dropItem, background:grupoSel?.id===g.id?'#e3f2fd':'#fff',
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:grupoSel?.id===g.id?700:400}}>{g.nombre}</span>
              <button onClick={e=>{e.stopPropagation();eliminarGrupo(g)}}
                style={{background:'none',border:'none',color:'#c62828',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {grupoSel && (
        <div style={{...S.tarjeta, flex:1}}>
          <div style={S.secTit}><span style={{fontSize:18}}>📌</span> Detalles de: {grupoSel.nombre}</div>
          <div style={{display:'flex',gap:6,marginBottom:10}}>
            <input style={{...S.inp,flex:1}} value={nuevoDet} onChange={e=>setNuevoDet(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&crearDetalle()} placeholder="Nombre del detalle…"/>
            <button onClick={crearDetalle} style={S.btnGuardar}><span style={{fontSize:16}}>➕</span> Agregar</button>
          </div>
          {detDelGrupo.length===0
            ? <div style={{color:'#aaa',textAlign:'center',padding:20}}>Sin detalles para este tipo.</div>
            : detDelGrupo.map(d=>(
              <div key={d.id} style={{...S.dropItem,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>{d.nombre}</span>
                <button onClick={()=>eliminarDetalle(d)}
                  style={{background:'none',border:'none',color:'#c62828',cursor:'pointer',fontSize:18}}>✕</button>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Gestión de Terceros ───────────────────────────────────────────────────
function GestionTerceros({ supabase, terceros, onRecargar }) {
  const [sel,   setSel]   = useState(null)
  const [form,  setForm]  = useState({cedrif:'',nombre:'',tipo_tercero:'GENERAL',ciudad:'',direccion:'',telefono:'',celular:'',email:''})
  const [nuevo, setNuevo] = useState(false)
  const [busy,  setBusy]  = useState(false)
  const [msg,   setMsg]   = useState(null)
  const [busq,  setBusq]  = useState('')
  const S = estilos

  const filtrados = terceros.filter(t=>
    !busq || (t.nombre||'').toLowerCase().includes(busq.toLowerCase()) || (t.cedrif||'').includes(busq)
  )

  function seleccionar(t) { setSel(t); setForm({...t}); setNuevo(false); setMsg(null) }
  function limpiar() { setSel(null); setForm({cedrif:'',nombre:'',tipo_tercero:'GENERAL',ciudad:'',direccion:'',telefono:'',celular:'',email:''}); setNuevo(true); setMsg(null) }

  async function guardar() {
    if (!form.nombre?.trim()) { setMsg({ok:false,txt:'El nombre es obligatorio.'}); return }
    setBusy(true)
    const payload = { cedrif:form.cedrif||null, nombre:form.nombre.trim(),
      tipo_tercero:form.tipo_tercero, ciudad:form.ciudad||null, direccion:form.direccion||null,
      telefono:form.telefono||null, celular:form.celular||null,
      email:form.email||null, activo:true }
    const { error } = nuevo
      ? await supabase.from('terceros').insert(payload)
      : await supabase.from('terceros').update(payload).eq('id', sel.id)
    if (error) { setMsg({ok:false,txt:error.message}) }
    else { setMsg({ok:true,txt:'✅ Tercero guardado.'}); onRecargar(); setSel(null); setNuevo(false) }
    setBusy(false)
  }

  async function retirar() {
    if (!sel) return
    await supabase.from('terceros').update({activo:false}).eq('id', sel.id)
    setMsg({ok:true,txt:'Tercero retirado.'}); onRecargar(); setSel(null)
  }

  return (
    <div style={{display:'flex',gap:14}}>
      <div style={{...S.tarjeta,width:340,flexShrink:0}}>
        <div style={{...S.fila,marginBottom:8}}>
          <input style={{...S.inp,flex:1}} value={busq} onChange={e=>setBusq(e.target.value)} placeholder="Buscar tercero…"/>
          <button onClick={limpiar} style={S.btnGuardar}><span style={{fontSize:16}}>➕</span> Nuevo</button>
        </div>
        <div style={{maxHeight:500,overflowY:'auto'}}>
          {filtrados.map(t=>(
            <div key={t.id} onClick={()=>seleccionar(t)}
              style={{...S.dropItem,background:sel?.id===t.id?'#e3f2fd':'#fff',display:'flex',flexDirection:'column',gap:2}}>
              <strong style={{fontSize:13}}>{t.nombre}</strong>
              <span style={{fontSize:11,color:'#888'}}>{t.tipo_tercero}{t.cedrif?` · ${t.cedrif}`:''}</span>
            </div>
          ))}
        </div>
      </div>

      {(sel||nuevo) && (
        <div style={{...S.tarjeta,flex:1}}>
          <div style={S.secTit}>{nuevo?<><span style={{fontSize:18}}>➕</span> Nuevo Tercero</>:<><span style={{fontSize:18}}>✏️</span> Editar — {sel?.nombre}</>}</div>
          {msg&&<div style={{...S.alerta,background:msg.ok?'#e8f5e9':'#ffebee',color:msg.ok?'#2e7d32':'#c62828',marginBottom:10}}>{msg.txt}</div>}
          <div style={S.fila}>
            <Campo label="Cédula / NIT" w={180}>
              <input style={S.inp} value={form.cedrif||''} onChange={e=>setForm(p=>({...p,cedrif:e.target.value}))}/>
            </Campo>
            <Campo label="Tipo de tercero" w={200}>
              <select style={S.inp} value={form.tipo_tercero||'GENERAL'} onChange={e=>setForm(p=>({...p,tipo_tercero:e.target.value}))}>
                {TIPOS_TERCERO.map(t=><option key={t}>{t}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Nombre / Razón Social *">
            <input style={S.inp} value={form.nombre||''} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} placeholder="Nombre completo…"/>
          </Campo>
          <Campo label="Dirección">
            <input style={S.inp} value={form.direccion||''} onChange={e=>setForm(p=>({...p,direccion:e.target.value}))} placeholder="Dirección completa"/>
          </Campo>
          <div style={S.fila}>
            <Campo label="Ciudad"><input style={S.inp} value={form.ciudad||''} onChange={e=>setForm(p=>({...p,ciudad:e.target.value}))}/></Campo>
            <Campo label="Teléfono"><input style={S.inp} value={form.telefono||''} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))}/></Campo>
            <Campo label="Celular"><input style={S.inp} value={form.celular||''} onChange={e=>setForm(p=>({...p,celular:e.target.value}))}/></Campo>
            <Campo label="Email"><input style={S.inp} value={form.email||''} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></Campo>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button onClick={guardar} disabled={busy} style={S.btnGuardar}><span style={{fontSize:16}}>💾</span> Guardar</button>
            {!nuevo&&<button onClick={retirar} style={{...S.btnLimpiar,background:'#fdecea',color:'#c62828'}}><span style={{fontSize:16}}>🚪</span> Retirar</button>}
            <button onClick={()=>{setSel(null);setNuevo(false);setMsg(null)}} style={S.btnLimpiar}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────
function Campo({label,children,w}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:3,flex:w?`0 0 ${w}px`:1}}>
      <label style={{fontSize:10,fontWeight:700,color:'#5577aa',textTransform:'uppercase',letterSpacing:0.5}}>{label}</label>
      {children}
    </div>
  )
}
function TabBtn({id,cur,set,label,icon}){
  return(
    <button onClick={()=>set(id)}
      style={{padding:'5px 12px',border:'none',borderRadius:5,cursor:'pointer',fontSize:12,fontWeight:cur===id?700:500,
        background:cur===id?'#1a3a6b':'rgba(255,255,255,0.2)',color:cur===id?'#fff':'rgba(255,255,255,0.85)'}}>
      {icon ? <><span style={{fontSize:16}}>{icon}</span> {label}</> : label}
    </button>
  )
}

const estilos = {
  pag:       {minHeight:'100vh',background:'#d6dce8',display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif'},
  head:      {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'8px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0,flexWrap:'wrap'},
  hTit:      {fontSize:15,fontWeight:900,color:'#fff',letterSpacing:2,marginRight:8},
  btnClose:  {marginLeft:'auto',background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  alerta:    {margin:'6px 12px 0',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:   {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:18},
  cuerpo:    {flex:1,padding:14,overflowY:'auto'},
  tarjeta:   {background:'#fff',borderRadius:8,padding:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:14},
  secTit:    {fontSize:14,fontWeight:800,color:'#1a3a6b',marginBottom:12,paddingBottom:8,borderBottom:'2px solid #eef0f5'},
  fila:      {display:'flex',gap:12,flexWrap:'wrap',marginBottom:10},
  inp:       {height:30,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:12,outline:'none',color:'#1a3a6b',width:'100%',boxSizing:'border-box'},
  drop:      {position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'#fff',border:'1px solid #c8d5ea',borderRadius:5,boxShadow:'0 6px 20px rgba(0,0,0,0.15)',maxHeight:260,overflowY:'auto'},
  dropItem:  {padding:'7px 10px',cursor:'pointer',borderBottom:'1px solid #f0f0f0',fontSize:12},
  tabla:     {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:     {background:'#1a3a6b'},
  th:        {padding:'7px 10px',color:'#fff',fontWeight:700,fontSize:11},
  td:        {padding:'5px 10px',borderBottom:'1px solid #eee'},
  btnGuardar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'6px 14px',cursor:'pointer',fontWeight:700,fontSize:12,whiteSpace:'nowrap'},
  btnLimpiar:{background:'#eee',color:'#333',border:'none',borderRadius:5,padding:'6px 14px',cursor:'pointer',fontWeight:700,fontSize:12},
  btnBuscar: {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 16px',cursor:'pointer',fontWeight:700,fontSize:12,height:30,whiteSpace:'nowrap'},
  btnPrint:  {background:'#2e7d32',color:'#fff',border:'none',borderRadius:5,padding:'0 14px',cursor:'pointer',fontWeight:700,fontSize:12,height:30},
}
