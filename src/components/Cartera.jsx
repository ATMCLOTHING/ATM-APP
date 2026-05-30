// src/components/Cartera.jsx
// v3 — corrige bug anulada null, agrega abonos distribuidos entre notas

import { useState, useEffect, useRef } from 'react'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const fmtM = n => '$' + fmt(n)
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const diasDesde   = f => f ? Math.floor((new Date()-new Date(f))/(1000*60*60*24)) : 0
const colorMora   = d => d >= 90 ? '#c62828' : d >= 60 ? '#e65100' : d >= 30 ? '#f9a825' : '#2e7d32'
const bgMora      = d => d >= 90 ? '#fdecea' : d >= 60 ? '#fff3e0' : d >= 30 ? '#fffde7' : '#e8f5e9'

const TABS = [
  {id:'resumen', label:'📋 Resumen por Cliente'},
  {id:'detalle', label:'🔍 Detalle por Nota'},
]

export default function Cartera({ supabase, usuario, onClose }) {
  const [vendedores,  setVendedores]  = useState([])
  const [filtVend,    setFiltVend]    = useState('')
  const [filtCliente, setFiltCliente] = useState('')
  const [filtEstado,  setFiltEstado]  = useState('pendiente')
  const [filtMora,    setFiltMora]    = useState('todas')
  const [notas,       setNotas]       = useState([])
  const [resumen,     setResumen]     = useState([])
  const [totales,     setTotales]     = useState({valor:0,abonado:0,saldo:0})
  const [cargando,    setCargando]    = useState(false)
  const [generado,    setGenerado]    = useState(false)
  const [tab,         setTab]         = useState('resumen')

  // ── abonos ──
  const [notasSel,    setNotasSel]    = useState({})   // {numnotaent: true}
  const [valorAbono,  setValorAbono]  = useState('')
  const [medioAbono,  setMedioAbono]  = useState('E')
  const [distribucio, setDistribucio] = useState([])   // [{numnotaent, aplicar, saldo}]
  const [modoAbono,   setModoAbono]   = useState(false)
  const [guardandoA,  setGuardandoA]  = useState(false)
  const [msgAbono,    setMsgAbono]    = useState(null)

  const printRef = useRef()

  useEffect(() => {
    supabase.from('vendedores').select('cedula,nombre').order('nombre')
      .then(({data}) => setVendedores(data||[]))
    // vendedor ve solo sus notas
    if (usuario?.rol === 'vendedor' && usuario?.cedula_vendedor) {
      setFiltVend(usuario.cedula_vendedor)
    }
  }, [])

  // ── GENERAR ──────────────────────────────────────────────────────────────
  async function generar() {
    setCargando(true); setGenerado(false); setModoAbono(false)
    setNotasSel({}); setDistribucio([]); setMsgAbono(null)

    // FIX: usar neq('anulada','S') en lugar de eq('anulada','N')
    // así captura null y cualquier valor distinto de 'S'
    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,fechavence,cedrifclie,nombreclie,cedvended,valtotal,valabono,saldo,formapago,mediopago,anulada')
      .neq('anulada', 'S')
      .order('fechanotae', {ascending:true})

    // filtro vendedor
    const cedVend = filtVend || (usuario?.rol==='vendedor' ? usuario?.cedula_vendedor : '')
    if (cedVend) q = q.eq('cedvended', cedVend)

    // filtro estado
    if (filtEstado === 'pendiente') q = q.gt('saldo', 0)
    else if (filtEstado === 'pagada') q = q.lte('saldo', 0)

    // filtro cliente
    if (filtCliente.trim()) q = q.ilike('nombreclie', `%${filtCliente.trim()}%`)

    const {data, error} = await q.limit(5000)

    let resultado = (data||[]).map(n => ({
      ...n,
      diasNota:    diasDesde(n.fechanotae),
      diasVencido: n.fechavence ? Math.max(0, diasDesde(n.fechavence)) : 0,
    }))

    // filtro mora
    if (filtMora === 'mora30') resultado = resultado.filter(n => n.diasVencido >= 30)
    else if (filtMora === 'mora60') resultado = resultado.filter(n => n.diasVencido >= 60)
    else if (filtMora === 'mora90') resultado = resultado.filter(n => n.diasVencido >= 90)

    setNotas(resultado)

    // resumen agrupado por cliente
    const mapa = {}
    resultado.forEach(n => {
      const k = n.cedrifclie || n.nombreclie || 'SIN CLIENTE'
      if (!mapa[k]) mapa[k] = {cedula:n.cedrifclie||'', nombre:n.nombreclie||'SIN NOMBRE', notas:0, valor:0, abonado:0, saldo:0, maxMora:0}
      mapa[k].notas++
      mapa[k].valor   += n.valtotal||0
      mapa[k].abonado += n.valabono||0
      mapa[k].saldo   += n.saldo||0
      mapa[k].maxMora  = Math.max(mapa[k].maxMora, n.diasVencido||0)
    })
    const res = Object.values(mapa).sort((a,b) => b.saldo - a.saldo)
    setResumen(res)

    const tot = resultado.reduce((acc,n) => ({
      valor:   acc.valor   + (n.valtotal||0),
      abonado: acc.abonado + (n.valabono||0),
      saldo:   acc.saldo   + (n.saldo||0),
    }), {valor:0,abonado:0,saldo:0})
    setTotales(tot)

    setGenerado(true); setCargando(false)
  }

  // ── SELECCIÓN DE NOTAS PARA ABONAR ───────────────────────────────────────
  function toggleNota(num) {
    setNotasSel(prev => {
      const nuevo = {...prev}
      if (nuevo[num]) delete nuevo[num]
      else nuevo[num] = true
      return nuevo
    })
    setDistribucio([])
    setMsgAbono(null)
  }

  function seleccionarTodas() {
    const sel = {}
    notas.filter(n => (n.saldo||0) > 0).forEach(n => { sel[n.numnotaent] = true })
    setNotasSel(sel)
    setDistribucio([])
  }

  function limpiarSeleccion() {
    setNotasSel({})
    setDistribucio([])
    setMsgAbono(null)
  }

  // ── DISTRIBUIR ABONO ──────────────────────────────────────────────────────
  // Aplica el valor disponible a las notas seleccionadas en orden cronológico
  function distribuir() {
    setMsgAbono(null)
    const val = Number(valorAbono)
    if (!val || val <= 0) { setMsgAbono({ok:false, txt:'Ingresa un valor de abono válido.'}); return }
    const seleccionadas = notas
      .filter(n => notasSel[n.numnotaent] && (n.saldo||0) > 0)
      .sort((a,b) => new Date(a.fechanotae) - new Date(b.fechanotae)) // cronológico

    if (!seleccionadas.length) { setMsgAbono({ok:false, txt:'Selecciona al menos una nota con saldo.'}); return }

    let disponible = val
    const dist = seleccionadas.map(n => {
      const saldo = n.saldo||0
      const aplicar = Math.min(disponible, saldo)
      disponible = Math.max(0, disponible - aplicar)
      return { numnotaent:n.numnotaent, nombreclie:n.nombreclie, saldo, aplicar }
    })

    if (disponible > 0) {
      setMsgAbono({ok:false, txt:`⚠️ El abono ($${fmt(val)}) supera el saldo de las notas seleccionadas ($${fmt(val - disponible)}). Ajusta el valor.`})
    }

    setDistribucio(dist)
  }

  // ── GUARDAR ABONOS ────────────────────────────────────────────────────────
  async function guardarAbonos() {
    if (!distribucio.length) { setMsgAbono({ok:false, txt:'Primero distribuye el abono.'}); return }
    setGuardandoA(true); setMsgAbono(null)
    try {
      for (const d of distribucio) {
        if (d.aplicar <= 0) continue
        // insertar abono
        const {error:ea} = await supabase.from('detabonos').insert({
          numnotaent: String(d.numnotaent),
          fechaabono: hoy(),
          valabono:   d.aplicar,
          mediopago:  medioAbono,
          observacio: 'Abono cartera',
        })
        if (ea) throw ea
        // actualizar saldo en encnotaen
        const notaActual = notas.find(n => n.numnotaent === d.numnotaent)
        const nuevoAbono = (notaActual?.valabono||0) + d.aplicar
        const nuevoSaldo = Math.max(0, (notaActual?.saldo||0) - d.aplicar)
        const {error:eu} = await supabase.from('encnotaen').update({
          valabono: nuevoAbono,
          saldo:    nuevoSaldo,
          fecultabon: hoy(),
        }).eq('numnotaent', String(d.numnotaent))
        if (eu) throw eu
      }
      const totalAplicado = distribucio.reduce((s,d) => s + d.aplicar, 0)
      setMsgAbono({ok:true, txt:`✅ Abono de $${fmt(totalAplicado)} aplicado correctamente a ${distribucio.filter(d=>d.aplicar>0).length} nota(s).`})
      setModoAbono(false)
      setNotasSel({})
      setDistribucio([])
      setValorAbono('')
      await generar() // recargar
    } catch(e) {
      setMsgAbono({ok:false, txt:'Error al guardar: ' + (e.message||e)})
    }
    setGuardandoA(false)
  }

  // ── IMPRIMIR ──────────────────────────────────────────────────────────────
  function imprimir(tipo) {
    const vendNombre = vendedores.find(v=>v.cedula===filtVend)?.nombre || 'Todos'
    const titulo = tipo === 'resumen'
      ? `CARTERA VIGENTE — RESUMEN\nVendedor: ${vendNombre}`
      : `CARTERA VIGENTE — DETALLE\nVendedor: ${vendNombre}`

    const filas = tipo === 'resumen'
      ? resumen.map(c => `${c.cedula}\t${c.nombre}\t${c.notas}\t${fmtM(c.valor)}\t${fmtM(c.abonado)}\t${fmtM(c.saldo)}\t${c.maxMora} días`).join('\n')
      : notas.map(n => `${n.numnotaent}\t${n.fechanotae?.slice(0,10)}\t${n.nombreclie}\t${fmtM(n.valtotal)}\t${fmtM(n.valabono)}\t${fmtM(n.saldo)}\t${n.diasVencido} días`).join('\n')

    const w = window.open('','_blank','width=900,height=700')
    w.document.write(`<html><head><title>${titulo}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
    h2{color:#1a3a6b}table{width:100%;border-collapse:collapse}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:left}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    tr:nth-child(even){background:#f5f7ff}
    .tot{font-weight:bold;background:#e8eaf6!important}
    @media print{button{display:none}}</style></head><body>
    <h2>${titulo.replace('\n','<br>')}</h2>
    <p>Generado: ${new Date().toLocaleString('es-CO')} | Estado: ${filtEstado} | Mora: ${filtMora}</p>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 18px;background:#1a3a6b;color:#fff;border:none;borderRadius:4px;cursor:pointer">🖨 Imprimir</button>`)

    if (tipo === 'resumen') {
      w.document.write(`<table><thead><tr><th>Cédula</th><th>Cliente</th><th>Notas</th><th>$ Valor</th><th>$ Abonado</th><th>$ Saldo</th><th>Días mora</th></tr></thead><tbody>`)
      resumen.forEach(c => {
        w.document.write(`<tr><td>${c.cedula}</td><td>${c.nombre}</td><td style="text-align:right">${c.notas}</td><td style="text-align:right">${fmtM(c.valor)}</td><td style="text-align:right">${fmtM(c.abonado)}</td><td style="text-align:right;color:#c62828;font-weight:bold">${fmtM(c.saldo)}</td><td style="text-align:right">${c.maxMora}</td></tr>`)
      })
      w.document.write(`<tr class="tot"><td colspan="2">TOTALES — ${resumen.length} clientes</td><td style="text-align:right">${notas.length}</td><td style="text-align:right">${fmtM(totales.valor)}</td><td style="text-align:right">${fmtM(totales.abonado)}</td><td style="text-align:right;color:#c62828">${fmtM(totales.saldo)}</td><td></td></tr>`)
    } else {
      w.document.write(`<table><thead><tr><th>Nota</th><th>Fecha</th><th>Vence</th><th>Cliente</th><th>$ Valor</th><th>$ Abonado</th><th>$ Saldo</th><th>Días nota</th><th>Días vencido</th></tr></thead><tbody>`)
      notas.forEach(n => {
        w.document.write(`<tr><td>${n.numnotaent}</td><td>${n.fechanotae?.slice(0,10)||''}</td><td>${n.fechavence?.slice(0,10)||''}</td><td>${n.nombreclie}</td><td style="text-align:right">${fmtM(n.valtotal)}</td><td style="text-align:right">${fmtM(n.valabono)}</td><td style="text-align:right;color:#c62828;font-weight:bold">${fmtM(n.saldo)}</td><td style="text-align:right">${n.diasNota}</td><td style="text-align:right;color:${colorMora(n.diasVencido)}">${n.diasVencido}</td></tr>`)
      })
      w.document.write(`<tr class="tot"><td colspan="4">TOTALES — ${notas.length} notas</td><td style="text-align:right">${fmtM(totales.valor)}</td><td style="text-align:right">${fmtM(totales.abonado)}</td><td style="text-align:right;color:#c62828">${fmtM(totales.saldo)}</td><td colspan="2"></td></tr>`)
    }
    w.document.write(`</tbody></table></body></html>`)
    w.document.close()
  }

  const notasSelArr = notas.filter(n => notasSel[n.numnotaent])
  const saldoSel    = notasSelArr.reduce((s,n) => s+(n.saldo||0), 0)

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerTxt}>
          <span style={S.headerTit}>CARTERA</span>
        </div>
        <button onClick={onClose} style={S.btnMenu}>← Menú</button>
      </div>

      {/* FILTROS */}
      <div style={S.filtros}>
        <Fld label="Vendedor" w={220}>
          <select style={S.inp} value={filtVend} onChange={e=>setFiltVend(e.target.value)}
            disabled={usuario?.rol==='vendedor'}>
            <option value="">— Todos —</option>
            {vendedores.map(v=><option key={v.cedula} value={v.cedula}>{v.nombre}</option>)}
          </select>
        </Fld>
        <Fld label="Cliente" w={200}>
          <input style={S.inp} value={filtCliente} onChange={e=>setFiltCliente(e.target.value)}
            placeholder="Nombre del cliente..." onKeyDown={e=>e.key==='Enter'&&generar()}/>
        </Fld>
        <Fld label="Estado" w={140}>
          <select style={S.inp} value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}>
            <option value="pendiente">Pendientes</option>
            <option value="pagada">Pagadas</option>
            <option value="todas">Todas</option>
          </select>
        </Fld>
        <Fld label="Mora mínima" w={140}>
          <select style={S.inp} value={filtMora} onChange={e=>setFiltMora(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="mora30">+30 días</option>
            <option value="mora60">+60 días</option>
            <option value="mora90">+90 días</option>
          </select>
        </Fld>
        <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
          <button onClick={generar} disabled={cargando} style={S.btnGenerar}>
            {cargando ? '⏳ Cargando…' : '🔍 Generar'}
          </button>
          {generado && <>
            <button onClick={()=>imprimir('resumen')} style={S.btnPrint}>🖨 Resumen</button>
            <button onClick={()=>imprimir('detalle')} style={S.btnPrint}>🖨 Detalle</button>
          </>}
        </div>
      </div>

      {!generado && !cargando && (
        <div style={{textAlign:'center',padding:60,color:'#aab8d4',fontSize:14}}>
          Selecciona los filtros y presiona <strong>Generar</strong>
        </div>
      )}

      {generado && (
        <>
          {/* TOTALES RÁPIDOS */}
          <div style={S.totalBar}>
            <Tot label="Clientes" val={resumen.length}          color="#1a3a6b"/>
            <Tot label="Notas"    val={notas.length}            color="#e65100"/>
            <Tot label="$ Valor"  val={fmtM(totales.valor)}     color="#555"/>
            <Tot label="$ Abonado" val={fmtM(totales.abonado)}  color="#2e7d32"/>
            <Tot label="$ Saldo"  val={fmtM(totales.saldo)}     color="#c62828" grande/>
          </div>

          {/* TABS */}
          <div style={S.tabs}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{...S.tab,...(tab===t.id?S.tabActivo:{})}}>
                {t.label}
              </button>
            ))}
            {/* Botón abonar */}
            {(usuario?.rol==='admin'||usuario?.rol==='vendedor'||usuario?.rol==='cajera') && (
              <button onClick={()=>{setModoAbono(!modoAbono);setDistribucio([]);setMsgAbono(null)}}
                style={{...S.tab,marginLeft:'auto',background:modoAbono?'#1a3a6b':'#2e7d32',color:'#fff',border:'none'}}>
                💵 {modoAbono ? 'Cancelar abono' : 'Registrar abono'}
              </button>
            )}
          </div>

          {/* PANEL DE ABONOS */}
          {modoAbono && (
            <div style={S.abonoPanel}>
              <div style={S.abonoPanelTit}>
                💵 REGISTRAR ABONO — selecciona las notas y el valor total a distribuir
              </div>

              <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:10}}>
                <Fld label="Valor total del abono" w={200}>
                  <input style={{...S.inp,fontWeight:700,fontSize:15}} type="number" min={0}
                    value={valorAbono} onChange={e=>setValorAbono(e.target.value)}
                    placeholder="$0" onKeyDown={e=>e.key==='Enter'&&distribuir()}/>
                </Fld>
                <Fld label="Medio de pago" w={150}>
                  <select style={S.inp} value={medioAbono} onChange={e=>setMedioAbono(e.target.value)}>
                    <option value="E">Efectivo</option>
                    <option value="T">Transferencia</option>
                    <option value="M">Mixto</option>
                  </select>
                </Fld>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={seleccionarTodas} style={S.btnSel}>Seleccionar todas</button>
                  <button onClick={limpiarSeleccion} style={S.btnSel}>Limpiar selección</button>
                  <button onClick={distribuir} style={{...S.btnGenerar,background:'#1565c0'}}>
                    ⚡ Distribuir
                  </button>
                </div>
              </div>

              {Object.keys(notasSel).length > 0 && (
                <div style={{fontSize:12,color:'#555',marginBottom:6}}>
                  {Object.keys(notasSel).length} nota(s) seleccionadas — Saldo total: <strong>{fmtM(saldoSel)}</strong>
                </div>
              )}

              {/* Resultado de distribución */}
              {distribucio.length > 0 && (
                <div style={S.distBox}>
                  <div style={{fontWeight:700,marginBottom:8,fontSize:13}}>Distribución propuesta:</div>
                  {distribucio.map(d=>(
                    <div key={d.numnotaent} style={S.distFila}>
                      <span style={{fontWeight:700}}>Nota #{d.numnotaent}</span>
                      <span style={{color:'#555'}}>{d.nombreclie}</span>
                      <span>Saldo: <strong>{fmtM(d.saldo)}</strong></span>
                      <span style={{color:'#2e7d32',fontWeight:700}}>Aplica: {fmtM(d.aplicar)}</span>
                      <span style={{color: d.saldo-d.aplicar===0?'#2e7d32':'#c62828'}}>
                        Resta: {fmtM(d.saldo-d.aplicar)}
                      </span>
                    </div>
                  ))}
                  <div style={{marginTop:10,display:'flex',gap:10,alignItems:'center'}}>
                    <button onClick={guardarAbonos} disabled={guardandoA} style={S.btnGuardar}>
                      {guardandoA ? '⏳ Guardando…' : '💾 Confirmar y guardar'}
                    </button>
                    <span style={{fontSize:12,color:'#666'}}>
                      Total a aplicar: <strong>{fmtM(distribucio.reduce((s,d)=>s+d.aplicar,0))}</strong>
                    </span>
                  </div>
                </div>
              )}

              {msgAbono && (
                <div style={{...S.msg, ...(msgAbono.ok ? S.msgOk : S.msgErr)}}>{msgAbono.txt}</div>
              )}
            </div>
          )}

          {/* CONTENIDO TABS */}
          <div style={S.contenido}>
            {/* RESUMEN */}
            {tab==='resumen' && (
              <table style={S.tabla}>
                <thead>
                  <tr style={S.thead}>
                    {['Cédula','Cliente','Notas','$ Valor','$ Abonado','$ Saldo','Días mora'].map(h=>(
                      <th key={h} style={{...S.th,textAlign:['Notas','$ Valor','$ Abonado','$ Saldo','Días mora'].includes(h)?'right':'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumen.length === 0
                    ? <tr><td colSpan={7} style={{textAlign:'center',padding:30,color:'#aaa'}}>Sin resultados con esos filtros.</td></tr>
                    : resumen.map((c,i) => (
                      <tr key={c.cedula||i} style={{background:i%2===0?'#fff':'#f5f7ff'}}>
                        <td style={S.td}>{c.cedula}</td>
                        <td style={{...S.td,fontWeight:600}}>{c.nombre}</td>
                        <td style={{...S.td,textAlign:'right'}}>{c.notas}</td>
                        <td style={{...S.td,textAlign:'right'}}>{fmtM(c.valor)}</td>
                        <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(c.abonado)}</td>
                        <td style={{...S.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>{fmtM(c.saldo)}</td>
                        <td style={{...S.td,textAlign:'right'}}>
                          <span style={{background:bgMora(c.maxMora),color:colorMora(c.maxMora),padding:'2px 8px',borderRadius:10,fontWeight:700,fontSize:12}}>
                            {c.maxMora}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
                <tfoot>
                  <tr style={{background:'#e8eaf6',fontWeight:700}}>
                    <td style={S.td} colSpan={2}>TOTALES — {resumen.length} clientes</td>
                    <td style={{...S.td,textAlign:'right'}}>{notas.length}</td>
                    <td style={{...S.td,textAlign:'right'}}>{fmtM(totales.valor)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(totales.abonado)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#c62828'}}>{fmtM(totales.saldo)}</td>
                    <td style={S.td}></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* DETALLE */}
            {tab==='detalle' && (
              <table style={S.tabla}>
                <thead>
                  <tr style={S.thead}>
                    {modoAbono && <th style={S.th}>✓</th>}
                    {['Nota','Fecha','Vence','Cliente','$ Valor','$ Abonado','$ Saldo','Días nota','Días vencido'].map(h=>(
                      <th key={h} style={{...S.th,textAlign:['$ Valor','$ Abonado','$ Saldo','Días nota','Días vencido'].includes(h)?'right':'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notas.length === 0
                    ? <tr><td colSpan={modoAbono?10:9} style={{textAlign:'center',padding:30,color:'#aaa'}}>Sin resultados con esos filtros.</td></tr>
                    : notas.map((n,i) => {
                      const selec = !!notasSel[n.numnotaent]
                      return (
                        <tr key={n.numnotaent} style={{background:selec?'#e8f5e9':i%2===0?'#fff':'#f5f7ff',cursor:modoAbono?'pointer':'default'}}
                          onClick={()=>modoAbono&&(n.saldo||0)>0&&toggleNota(n.numnotaent)}>
                          {modoAbono && (
                            <td style={{...S.td,textAlign:'center'}}>
                              {(n.saldo||0)>0
                                ? <input type="checkbox" checked={selec} onChange={()=>toggleNota(n.numnotaent)} onClick={e=>e.stopPropagation()}/>
                                : <span style={{color:'#aaa',fontSize:10}}>pagada</span>
                              }
                            </td>
                          )}
                          <td style={{...S.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                          <td style={S.td}>{n.fechanotae?.slice(0,10)||''}</td>
                          <td style={S.td}>{n.fechavence?.slice(0,10)||''}</td>
                          <td style={{...S.td,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.nombreclie}</td>
                          <td style={{...S.td,textAlign:'right'}}>{fmtM(n.valtotal)}</td>
                          <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(n.valabono)}</td>
                          <td style={{...S.td,textAlign:'right',fontWeight:700,color:n.saldo>0?'#c62828':'#2e7d32'}}>{fmtM(n.saldo)}</td>
                          <td style={{...S.td,textAlign:'right',color:'#888'}}>{n.diasNota}</td>
                          <td style={{...S.td,textAlign:'right'}}>
                            {n.diasVencido > 0
                              ? <span style={{background:bgMora(n.diasVencido),color:colorMora(n.diasVencido),padding:'2px 8px',borderRadius:10,fontWeight:700,fontSize:11}}>{n.diasVencido}</span>
                              : <span style={{color:'#2e7d32',fontSize:11}}>vigente</span>
                            }
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
                <tfoot>
                  <tr style={{background:'#e8eaf6',fontWeight:700}}>
                    {modoAbono && <td style={S.td}></td>}
                    <td style={S.td} colSpan={4}>TOTALES — {notas.length} notas</td>
                    <td style={{...S.td,textAlign:'right'}}>{fmtM(totales.valor)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#2e7d32'}}>{fmtM(totales.abonado)}</td>
                    <td style={{...S.td,textAlign:'right',color:'#c62828'}}>{fmtM(totales.saldo)}</td>
                    <td style={S.td} colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Fld({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:4,width:w,flexShrink:0}}>
      <label style={{fontSize:11,fontWeight:700,color:'#5577aa',textTransform:'uppercase'}}>{label}</label>
      {children}
    </div>
  )
}
function Tot({label,val,color,grande}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
      <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase'}}>{label}</span>
      <span style={{fontSize:grande?18:14,fontWeight:900,color}}>{val}</span>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = {
  wrap:       {minHeight:'100vh',background:'#eef2f7',display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif'},
  header:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  headerTxt:  {display:'flex',flexDirection:'column'},
  headerTit:  {color:'#fff',fontWeight:900,fontSize:18,letterSpacing:2},
  btnMenu:    {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'6px 16px',cursor:'pointer',fontSize:13,fontWeight:700},
  filtros:    {display:'flex',flexWrap:'wrap',gap:12,padding:'14px 16px',background:'#fff',borderBottom:'1px solid #dde3ee',alignItems:'flex-end'},
  inp:        {height:32,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 9px',fontSize:13,background:'#fff',outline:'none',width:'100%',color:'#1a3a6b',boxSizing:'border-box'},
  btnGenerar: {height:32,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'0 18px',cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap'},
  btnPrint:   {height:32,background:'#2e7d32',color:'#fff',border:'none',borderRadius:6,padding:'0 14px',cursor:'pointer',fontSize:12,fontWeight:700},
  btnSel:     {height:32,background:'#eef2ff',color:'#1a3a6b',border:'1px solid #c8d5ea',borderRadius:6,padding:'0 12px',cursor:'pointer',fontSize:12,fontWeight:600},
  btnGuardar: {height:36,background:'#2e7d32',color:'#fff',border:'none',borderRadius:6,padding:'0 20px',cursor:'pointer',fontSize:13,fontWeight:700},
  totalBar:   {display:'flex',gap:20,padding:'10px 20px',background:'#fff',borderBottom:'1px solid #dde3ee',flexWrap:'wrap'},
  tabs:       {display:'flex',gap:4,padding:'8px 16px',background:'#f5f7fb',borderBottom:'1px solid #dde3ee'},
  tab:        {padding:'7px 16px',border:'1px solid #c8d5ea',borderRadius:'6px 6px 0 0',background:'#fff',color:'#555',cursor:'pointer',fontSize:13,fontWeight:600},
  tabActivo:  {background:'#1a3a6b',color:'#fff',border:'1px solid #1a3a6b'},
  contenido:  {flex:1,overflowY:'auto',padding:'0 0 20px'},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:      {background:'#1a3a6b',position:'sticky',top:0,zIndex:2},
  th:         {padding:'8px 10px',fontWeight:700,color:'#fff',whiteSpace:'nowrap',fontSize:12},
  td:         {padding:'6px 10px',borderBottom:'1px solid #eee',verticalAlign:'middle'},
  // panel abonos
  abonoPanel: {background:'#f0f7ff',border:'1px solid #90caf9',margin:'8px 16px',borderRadius:8,padding:'14px 18px'},
  abonoPanelTit:{fontWeight:700,color:'#1565c0',marginBottom:10,fontSize:13},
  distBox:    {background:'#fff',border:'1px solid #c8d5ea',borderRadius:6,padding:'12px',marginTop:8},
  distFila:   {display:'flex',gap:16,padding:'5px 0',borderBottom:'1px solid #f0f0f0',fontSize:13,flexWrap:'wrap',alignItems:'center'},
  msg:        {borderRadius:6,padding:'8px 14px',fontSize:13,fontWeight:600,marginTop:8},
  msgOk:      {background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7'},
  msgErr:     {background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a'},
}
