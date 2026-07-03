// src/components/Comisiones.jsx
// Módulo de liquidación de comisiones por vendedor

import React, { useState, useEffect } from 'react'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const fmtM = n => '$' + fmt(n)
const fmtP = n => Number(n||0).toFixed(1) + '%'
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

const CAJERAS = ['caja1','caja2','caja3']

export default function Comisiones({ supabase, usuario, onClose, onAyuda }) {
  const [vendedores,   setVendedores]   = useState([])
  const [filtVend,     setFiltVend]     = useState('')
  const [desde,        setDesde]        = useState('')
  const [hasta,        setHasta]        = useState(hoy())
  const [usarFecha,    setUsarFecha]    = useState(false)
  const [notas,        setNotas]        = useState([])
  const [notasSel,     setNotasSel]     = useState({})
  const [cargando,     setCargando]     = useState(false)
  const [generado,     setGenerado]     = useState(false)
  const [liquidando,   setLiquidando]   = useState(false)
  const [msg,          setMsg]          = useState(null)
  const [historial,    setHistorial]    = useState([])
  const [histSel,      setHistSel]      = useState(null)   // liquidación seleccionada
  const [histDetalle,  setHistDetalle]  = useState([])     // notas de esa liquidación
  const [cargandoDet,  setCargandoDet]  = useState(false)
  const [tab,          setTab]          = useState('liquidar')
  // Edición de porcentajes
  const [editando,     setEditando]     = useState(false)
  const [porcEdit,     setPorcEdit]     = useState({})

  useEffect(() => {
    cargarVendedores()
    cargarHistorial()
  }, [])

  async function cargarVendedores() {
    const {data} = await supabase.from('vendedores')
      .select('id,cedula,nombre,porcentaje_comision')
      .order('nombre')
    setVendedores(data||[])
    // init porcentajes para edición
    const p = {}
    ;(data||[]).forEach(v => { p[v.cedula] = v.porcentaje_comision||0 })
    setPorcEdit(p)
  }

  async function cargarHistorial() {
    const {data} = await supabase.from('comisiones')
      .select('*').order('fecregistr', {ascending:false}).limit(100)
    setHistorial(data||[])
  }

  async function guardarPorcentajes() {
    setMsg(null)
    let errores = 0
    for (const [cedula, porc] of Object.entries(porcEdit)) {
      const {error} = await supabase.from('vendedores')
        .update({porcentaje_comision: Number(porc)})
        .eq('cedula', cedula)
      if (error) errores++
    }
    if (errores === 0) {
      setMsg({ok:true, txt:'Porcentajes actualizados correctamente.'})
      setEditando(false)
      cargarVendedores()
    } else {
      setMsg({ok:false, txt:`Error al guardar ${errores} porcentaje(s).`})
    }
  }

  async function generar() {
    setMsg(null)
    if (!filtVend) { setMsg({ok:false, txt:'Selecciona un vendedor.'}); return }
    setCargando(true); setGenerado(false); setNotasSel({})

    // Notas pagadas del vendedor — no hechas por cajeras
    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,nombreclie,valtotal,valabono,saldo,formapago,mediopago,usuario,comision_pagada')
      .eq('cedvended', filtVend)
      .or('anulada.is.null,anulada.neq.S')
      .eq('comision_pagada', false)  // solo las no liquidadas aún
      .lte('saldo', 0)              // pagadas (saldo = 0)
      .order('fechanotae', {ascending:true})

    // Excluir notas hechas por cajeras
    // (las cajeras no generan comisión)

    if (usarFecha && desde) q = q.gte('fechanotae', desde)
    if (usarFecha && hasta) q = q.lte('fechanotae', hasta)

    const {data} = await q.limit(2000)

    // Filtrar en JS las que NO son de cajera
    const resultado = (data||[]).filter(n => !CAJERAS.includes((n.usuario||'').toLowerCase()))

    setNotas(resultado)
    // Seleccionar todas por defecto
    const sel = {}
    resultado.forEach(n => { sel[n.numnotaent] = true })
    setNotasSel(sel)
    setGenerado(true)
    setCargando(false)
  }

  function toggleNota(num) {
    setNotasSel(prev => {
      const n = {...prev}
      if (n[num]) delete n[num]
      else n[num] = true
      return n
    })
  }

  function selTodas()   { const s={}; notas.forEach(n=>{s[n.numnotaent]=true}); setNotasSel(s) }
  function limpiarSel() { setNotasSel({}) }

  const vendedor      = vendedores.find(v => v.cedula === filtVend)
  const porcComision  = Number(vendedor?.porcentaje_comision||0)
  const notasSelArr   = notas.filter(n => notasSel[n.numnotaent])
  const totalVentas   = notasSelArr.reduce((s,n) => s+(n.valtotal||0), 0)
  const valorComision = totalVentas * (porcComision/100)

  async function liquidar() {
    setMsg(null)
    if (!notasSelArr.length) { setMsg({ok:false, txt:'Selecciona al menos una nota.'}); return }
    if (porcComision <= 0)   { setMsg({ok:false, txt:'Este vendedor no tiene porcentaje de comisión configurado.'}); return }
    if (!window.confirm(`¿Confirmas liquidar comisión de ${fmtM(valorComision)} para ${vendedor?.nombre}?`)) return

    setLiquidando(true)
    try {
      // 1. Marcar notas como comision_pagada
      const nums = notasSelArr.map(n => n.numnotaent)
      const {error:e1} = await supabase.from('encnotaen')
        .update({comision_pagada: true})
        .in('numnotaent', nums)
      if (e1) throw e1

      // 2. Registrar en tabla comisiones
      const {data:comIns, error:e2} = await supabase.from('comisiones').insert({
        cedvended:         filtVend,
        nomvended:         vendedor?.nombre,
        fecha_liquidacion: hoy(),
        desde:             usarFecha && desde ? desde : null,
        hasta:             usarFecha && hasta ? hasta : hoy(),
        total_ventas:      totalVentas,
        porcentaje:        porcComision,
        valor_comision:    valorComision,
        observacion:       `${notasSelArr.length} notas liquidadas`,
        usuario:           usuario?.usuario || 'admin',
      }).select().single()
      if (e2) throw e2

      // 3. Guardar detalle de notas por liquidación
      if (comIns?.id) {
        await supabase.from('comisiones_detalle').insert(
          notasSelArr.map(n => ({
            comision_id:    comIns.id,
            numnotaent:     n.numnotaent,
            fechanotae:     n.fechanotae?.slice(0,10)||'',
            nombreclie:     n.nombreclie||'',
            valtotal:       n.valtotal||0,
            valor_comision: (n.valtotal||0)*(porcComision/100),
          }))
        )
      }

      setMsg({ok:true, txt:`✅ Comisión de ${fmtM(valorComision)} liquidada para ${vendedor?.nombre}. ${notasSelArr.length} notas marcadas.`})
      setGenerado(false)
      setNotasSel({})
      setNotas([])
      cargarHistorial()
    } catch(e) {
      setMsg({ok:false, txt:'Error: ' + (e.message||e)})
    }
    setLiquidando(false)
  }

  async function verDetalle(h) {
    if (histSel?.id === h.id) { setHistSel(null); setHistDetalle([]); return }
    setHistSel(h); setCargandoDet(true)
    const {data} = await supabase.from('comisiones_detalle')
      .select('*').eq('comision_id', h.id).order('fechanotae')
    setHistDetalle(data||[])
    setCargandoDet(false)
  }

  function imprimirLiquidacion(h, detalle) {
    const w = window.open('','_blank','width=800,height=600')
    w.document.write(`<html><head><title>Liquidación ${h.id}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;}
    h2,h3{color:#1a3a6b;text-align:center;}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:right;font-size:11px;}
    th:first-child,th:nth-child(2),th:nth-child(3){text-align:left;}
    td{padding:5px 8px;border-bottom:1px solid #eee;text-align:right;}
    td:first-child,td:nth-child(2),td:nth-child(3){text-align:left;}
    .tot{font-weight:900;background:#e8eaf6;}
    @media print{body{margin:8px;}}</style></head><body>
    <h2>ATM — LIQUIDACIÓN DE COMISIÓN</h2>
    <h3>${h.nomvended} — ${h.fecha_liquidacion}</h3>
    <p style="text-align:center;color:#555;">
      Total ventas: <b>$${fmt(h.total_ventas)}</b> &nbsp;|&nbsp;
      Porcentaje: <b>${Number(h.porcentaje||0).toFixed(1)}%</b> &nbsp;|&nbsp;
      Valor comisión: <b>$${fmt(h.valor_comision)}</b>
    </p>
    <table><thead><tr>
      <th>Nota</th><th>Fecha</th><th>Cliente</th>
      <th>$ Venta</th><th>$ Comisión</th>
    </tr></thead><tbody>
    ${detalle.map((d,i)=>`<tr style="background:${i%2===0?'#fff':'#f5f7fc'}">
      <td>${d.numnotaent}</td><td>${d.fechanotae}</td>
      <td>${d.nombreclie}</td>
      <td>$${fmt(d.valtotal)}</td>
      <td><b>$${fmt(d.valor_comision)}</b></td>
    </tr>`).join('')}
    <tr class="tot">
      <td colspan="3">TOTALES — ${detalle.length} notas</td>
      <td>$${fmt(detalle.reduce((s,d)=>s+(d.valtotal||0),0))}</td>
      <td><b>$${fmt(detalle.reduce((s,d)=>s+(d.valor_comision||0),0))}</b></td>
    </tr>
    </tbody></table>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  function imprimir() {
    const w = window.open('','_blank','width=800,height=600')
    w.document.write(`<html><head><title>Liquidación Comisión</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
    h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}
    th{background:#1a3a6b;color:#fff;padding:6px 8px}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    tr:nth-child(even){background:#f5f7ff}
    .tot{font-weight:bold;background:#e8eaf6!important}
    .resumen{background:#f0f7ff;border:1px solid #90caf9;padding:12px;border-radius:6px;margin-bottom:16px}
    @media print{button{display:none}}</style></head><body>
    <h2>ATM CLOTHING — LIQUIDACIÓN DE COMISIÓN</h2>
    <div class="resumen">
      <p><strong>Vendedor:</strong> ${vendedor?.nombre} (${filtVend})</p>
      <p><strong>Fecha liquidación:</strong> ${hoy()}</p>
      <p><strong>Notas liquidadas:</strong> ${notasSelArr.length}</p>
      <p><strong>Total ventas:</strong> ${fmtM(totalVentas)}</p>
      <p><strong>% Comisión:</strong> ${fmtP(porcComision)}</p>
      <p><strong>VALOR COMISIÓN: ${fmtM(valorComision)}</strong></p>
    </div>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 18px;background:#1a3a6b;color:#fff;border:none;cursor:pointer">🖨 Imprimir</button>
    <table><thead><tr><th>Nota</th><th>Fecha</th><th>Cliente</th><th>Forma Pago</th><th style="text-align:right">$ Total</th></tr></thead><tbody>
    ${notasSelArr.map(n=>`<tr><td>${n.numnotaent}</td><td>${n.fechanotae?.slice(0,10)||''}</td><td>${n.nombreclie||''}</td><td>${n.formapago||''}</td><td style="text-align:right">${fmtM(n.valtotal)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4">TOTALES — ${notasSelArr.length} notas</td><td style="text-align:right">${fmtM(totalVentas)}</td></tr>
    </tbody></table></body></html>`)
    w.document.close()
    setTimeout(()=>w.print(), 400)
  }

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <span style={S.headerTit}>💼 COMISIONES</span>
        {onAyuda && <button onClick={onAyuda} title="Ayuda" style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:14,marginLeft:'auto'}}>❓</button>}
        <button onClick={onClose} style={S.btnMenu}>← Menú</button>
      </div>

      {/* TABS */}
      <div style={S.tabs}>
        {[{id:'liquidar',label:'💵 Liquidar Comisión'},{id:'historial',label:'📋 Historial'},{id:'porcentajes',label:'⚙️ Porcentajes'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{...S.tab,...(tab===t.id?S.tabActivo:{})}}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{...S.msg,...(msg.ok?S.msgOk:S.msgErr),margin:'10px 16px'}}>
          {msg.txt}
          <button onClick={()=>setMsg(null)} style={{float:'right',background:'none',border:'none',cursor:'pointer',fontWeight:700}}>✕</button>
        </div>
      )}

      {/* ── TAB LIQUIDAR ── */}
      {tab==='liquidar' && (
        <div style={S.contenido}>
          {/* Filtros */}
          <div style={S.filtros}>
            <Fld label="Vendedor" w={260}>
              <select style={S.inp} value={filtVend} onChange={e=>setFiltVend(e.target.value)}>
                <option value="">— Selecciona vendedor —</option>
                {vendedores.map(v=>(
                  <option key={v.cedula} value={v.cedula}>
                    {v.nombre} {v.porcentaje_comision>0?`(${v.porcentaje_comision}%)`:'(sin %)'}
                  </option>
                ))}
              </select>
            </Fld>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:'#555',cursor:'pointer',alignSelf:'flex-end',marginBottom:4}}>
              <input type="checkbox" checked={usarFecha} onChange={e=>setUsarFecha(e.target.checked)}/>
              Filtrar por fecha
            </label>
            {usarFecha && <>
              <Fld label="Desde" w={140}>
                <input type="date" style={S.inp} value={desde} onChange={e=>setDesde(e.target.value)}/>
              </Fld>
              <Fld label="Hasta" w={140}>
                <input type="date" style={S.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/>
              </Fld>
            </>}
            <button onClick={generar} disabled={cargando} style={{...S.btn,alignSelf:'flex-end'}}>
              {cargando ? '⏳ Cargando…' : '🔍 Buscar notas'}
            </button>
          </div>

          {/* Resumen vendedor seleccionado */}
          {filtVend && vendedor && (
            <div style={S.resumenVend}>
              <span>Vendedor: <strong>{vendedor.nombre}</strong></span>
              <span>% Comisión: <strong style={{color:'#1565c0'}}>{fmtP(porcComision)}</strong></span>
              {generado && <>
                <span>Notas seleccionadas: <strong>{Object.keys(notasSel).length}</strong></span>
                <span>Total ventas: <strong>{fmtM(totalVentas)}</strong></span>
                <span style={{color:'#2e7d32',fontWeight:700,fontSize:15}}>
                  Comisión a pagar: <strong>{fmtM(valorComision)}</strong>
                </span>
              </>}
            </div>
          )}

          {/* Tabla de notas */}
          {generado && (
            <>
              <div style={S.acciones}>
                <button onClick={selTodas}   style={S.btnSec}>✅ Seleccionar todas</button>
                <button onClick={limpiarSel} style={S.btnSec}>☐ Limpiar selección</button>
                <button onClick={imprimir}   style={S.btnSec} disabled={!notasSelArr.length}>🖨 Imprimir liquidación</button>
                <button onClick={liquidar} disabled={liquidando||!notasSelArr.length}
                  style={{...S.btn,background:'#2e7d32',marginLeft:'auto'}}>
                  {liquidando ? '⏳ Liquidando…' : `💾 Liquidar ${fmtM(valorComision)}`}
                </button>
              </div>

              {notas.length === 0 ? (
                <div style={S.vacio}>No hay notas pagadas pendientes de liquidar para este vendedor.</div>
              ) : (
                <table style={S.tabla}>
                  <thead>
                    <tr style={S.thead}>
                      <th style={S.th}>✓</th>
                      <th style={S.th}>Nota</th>
                      <th style={S.th}>Fecha</th>
                      <th style={{...S.th,textAlign:'left'}}>Cliente</th>
                      <th style={S.th}>Forma Pago</th>
                      <th style={S.th}>Usuario</th>
                      <th style={{...S.th,textAlign:'right'}}>$ Total</th>
                      <th style={{...S.th,textAlign:'right'}}>Comisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notas.map((n,i) => {
                      const sel = !!notasSel[n.numnotaent]
                      const com = (n.valtotal||0) * (porcComision/100)
                      return (
                        <tr key={n.numnotaent}
                          style={{background:sel?'#e8f5e9':i%2===0?'#fff':'#f8faff',cursor:'pointer'}}
                          onClick={()=>toggleNota(n.numnotaent)}>
                          <td style={{...S.td,textAlign:'center'}}>
                            <input type="checkbox" checked={sel} onChange={()=>toggleNota(n.numnotaent)}
                              onClick={e=>e.stopPropagation()}/>
                          </td>
                          <td style={{...S.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                          <td style={S.td}>{n.fechanotae?.slice(0,10)||''}</td>
                          <td style={{...S.td,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.nombreclie}</td>
                          <td style={{...S.td,textAlign:'center'}}>{n.formapago}</td>
                          <td style={{...S.td,textAlign:'center',color:'#888',fontSize:11}}>{n.usuario||''}</td>
                          <td style={{...S.td,textAlign:'right',fontWeight:600}}>{fmtM(n.valtotal)}</td>
                          <td style={{...S.td,textAlign:'right',color:'#2e7d32',fontWeight:700}}>{sel?fmtM(com):'-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{background:'#e8eaf6',fontWeight:700}}>
                      <td style={S.td} colSpan={6}>TOTALES — {notasSelArr.length} notas seleccionadas de {notas.length}</td>
                      <td style={{...S.td,textAlign:'right'}}>{fmtM(totalVentas)}</td>
                      <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(valorComision)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB HISTORIAL ── */}
      {tab==='historial' && (
        <div style={S.contenido}>
          <div style={{padding:'10px 16px',fontSize:12,color:'#888'}}>
            {historial.length} liquidaciones — haz clic en una para ver el detalle de notas
          </div>
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                {['Fecha','Vendedor','Notas','Total Ventas','% Comisión','Valor Comisión','Usuario',''].map(h=>(
                  <th key={h} style={{...S.th,textAlign:['Total Ventas','Valor Comisión'].includes(h)?'right':'left'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historial.length === 0
                ? <tr><td colSpan={8} style={{textAlign:'center',padding:30,color:'#aaa'}}>No hay liquidaciones registradas.</td></tr>
                : historial.map((h,i)=>(
                  <React.Fragment key={h.id}>
                    <tr key={h.id}
                      onClick={()=>verDetalle(h)}
                      style={{background:histSel?.id===h.id?'#e3f2fd':i%2===0?'#fff':'#f8faff',cursor:'pointer'}}>
                      <td style={S.td}>{h.fecha_liquidacion}</td>
                      <td style={{...S.td,fontWeight:600}}>{h.nomvended}</td>
                      <td style={S.td}>{h.observacion}</td>
                      <td style={{...S.td,textAlign:'right'}}>{fmtM(h.total_ventas)}</td>
                      <td style={S.td}>{fmtP(h.porcentaje)}</td>
                      <td style={{...S.td,textAlign:'right',fontWeight:700,color:'#2e7d32'}}>{fmtM(h.valor_comision)}</td>
                      <td style={{...S.td,color:'#888',fontSize:11}}>{h.usuario}</td>
                      <td style={{...S.td,textAlign:'center'}}>
                        <button onClick={e=>{e.stopPropagation();imprimirLiquidacion(h,histSel?.id===h.id?histDetalle:[])}}
                          style={{...S.btnSec,padding:'2px 8px',fontSize:11}}>🖨</button>
                      </td>
                    </tr>
                    {histSel?.id===h.id && (
                      <tr key={`det-${h.id}`}>
                        <td colSpan={8} style={{padding:0}}>
                          {cargandoDet
                            ? <div style={{textAlign:'center',padding:12,color:'#888'}}>Cargando notas…</div>
                            : histDetalle.length === 0
                              ? <div style={{textAlign:'center',padding:12,color:'#aaa'}}>Sin detalle de notas (liquidación antigua).</div>
                              : (
                                <table style={{...S.tabla,margin:0,background:'#f0f7ff'}}>
                                  <thead>
                                    <tr style={{background:'#1565c0'}}>
                                      {['Nota','Fecha','Cliente','$ Venta','$ Comisión'].map(col=>(
                                        <th key={col} style={{...S.th,textAlign:['$ Venta','$ Comisión'].includes(col)?'right':'left',fontSize:11,padding:'5px 10px'}}>{col}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {histDetalle.map((d,j)=>(
                                      <tr key={d.id} style={{background:j%2===0?'#f0f7ff':'#e8f0ff'}}>
                                        <td style={{...S.td,fontWeight:700,color:'#1a3a6b'}}>{d.numnotaent}</td>
                                        <td style={S.td}>{d.fechanotae}</td>
                                        <td style={{...S.td,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombreclie}</td>
                                        <td style={{...S.td,textAlign:'right'}}>{fmtM(d.valtotal)}</td>
                                        <td style={{...S.td,textAlign:'right',fontWeight:700,color:'#2e7d32'}}>{fmtM(d.valor_comision)}</td>
                                      </tr>
                                    ))}
                                    <tr style={{background:'#c8dcf5',fontWeight:700}}>
                                      <td colSpan={3} style={S.td}>TOTALES — {histDetalle.length} notas</td>
                                      <td style={{...S.td,textAlign:'right'}}>{fmtM(histDetalle.reduce((s,d)=>s+(d.valtotal||0),0))}</td>
                                      <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(histDetalle.reduce((s,d)=>s+(d.valor_comision||0),0))}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              )
                          }
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB PORCENTAJES ── */}
      {tab==='porcentajes' && (
        <div style={{...S.contenido,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span style={{fontWeight:700,color:'#1a3a6b',fontSize:14}}>⚙️ Porcentajes de comisión por vendedor</span>
            {!editando
              ? <button onClick={()=>setEditando(true)} style={S.btn}>✏️ Editar porcentajes</button>
              : <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setEditando(false)} style={S.btnSec}>Cancelar</button>
                  <button onClick={guardarPorcentajes} style={{...S.btn,background:'#2e7d32'}}>💾 Guardar</button>
                </div>
            }
          </div>
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                <th style={{...S.th,textAlign:'left'}}>Cédula</th>
                <th style={{...S.th,textAlign:'left'}}>Nombre</th>
                <th style={{...S.th,textAlign:'right'}}>% Comisión</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v,i)=>(
                <tr key={v.cedula} style={{background:i%2===0?'#fff':'#f8faff'}}>
                  <td style={S.td}>{v.cedula}</td>
                  <td style={{...S.td,fontWeight:600}}>{v.nombre}</td>
                  <td style={{...S.td,textAlign:'right'}}>
                    {editando
                      ? <input type="number" min={0} max={100} step={0.5}
                          value={porcEdit[v.cedula]||0}
                          onChange={e=>setPorcEdit(prev=>({...prev,[v.cedula]:e.target.value}))}
                          style={{...S.inp,width:80,textAlign:'right'}}/>
                      : <span style={{fontWeight:700,color:v.porcentaje_comision>0?'#1565c0':'#aaa'}}>
                          {fmtP(v.porcentaje_comision||0)}
                        </span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Fld({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:4,width:w,flexShrink:0}}>
      <label style={{fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase'}}>{label}</label>
      {children}
    </div>
  )
}

const S = {
  wrap:       {minHeight:'100vh',background:'#eef2f7',display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif'},
  header:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  headerTit:  {color:'#fff',fontWeight:900,fontSize:18,letterSpacing:2},
  btnMenu:    {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'6px 16px',cursor:'pointer',fontSize:13,fontWeight:700},
  tabs:       {display:'flex',gap:4,padding:'8px 16px',background:'#f5f7fb',borderBottom:'1px solid #dde3ee'},
  tab:        {padding:'7px 16px',border:'1px solid #c8d5ea',borderRadius:'6px 6px 0 0',background:'#fff',color:'#555',cursor:'pointer',fontSize:13,fontWeight:600},
  tabActivo:  {background:'#1a3a6b',color:'#fff',border:'1px solid #1a3a6b'},
  contenido:  {flex:1,overflowY:'auto'},
  filtros:    {display:'flex',flexWrap:'wrap',gap:12,padding:'14px 16px',background:'#fff',borderBottom:'1px solid #dde3ee',alignItems:'flex-end'},
  inp:        {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 9px',fontSize:13,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b',boxSizing:'border-box'},
  btn:        {height:32,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'0 18px',cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap'},
  btnSec:     {height:32,background:'#eef2ff',color:'#1a3a6b',border:'1px solid #c8d5ea',borderRadius:6,padding:'0 14px',cursor:'pointer',fontSize:12,fontWeight:600},
  resumenVend:{display:'flex',gap:24,flexWrap:'wrap',padding:'10px 16px',background:'#f0f7ff',borderBottom:'1px solid #90caf9',fontSize:13,alignItems:'center'},
  acciones:   {display:'flex',gap:8,padding:'10px 16px',background:'#f9f9f9',borderBottom:'1px solid #eee',flexWrap:'wrap',alignItems:'center'},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:      {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:         {padding:'8px 10px',fontWeight:700,color:'#fff',whiteSpace:'nowrap',fontSize:12},
  td:         {padding:'6px 10px',borderBottom:'1px solid #eee',verticalAlign:'middle'},
  vacio:      {textAlign:'center',padding:40,color:'#aaa',fontSize:13},
  msg:        {borderRadius:6,padding:'10px 14px',fontSize:13,fontWeight:600},
  msgOk:      {background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7'},
  msgErr:     {background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a'},
}
