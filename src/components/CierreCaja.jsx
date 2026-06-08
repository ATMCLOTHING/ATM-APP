import { useState } from 'react'
import { WZCLOSE, WZPRINT, WZLOCATE } from '../lib/assets'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})

const normMedio = m => {
  if (!m) return 'efectivo'
  const v = String(m).trim().toUpperCase()
  if (v==='E' || v==='EFECTIVO')                   return 'efectivo'
  if (v==='T' || v==='TRANSFERENCIA')              return 'transferencia'
  if (v==='M' || v==='MIXTO')                      return 'mixto'
  if (v==='C' || v==='CREDITO' || v==='CRÉDITO')   return 'credito'
  return 'efectivo'
}

// cedvended con cédula larga = vendedor externo (no del mostrador)
const esVendedorExterno = cedv => {
  const n = Number(cedv)
  return n > 1000
}

const LABEL_CAJA = {
  'caja1': 'Caja 1', 'caja2': 'Caja 2', 'caja3': 'Caja 3',
  'admin': 'Admin',  'laura': 'Laura (vendedora)', 'prendas': 'Bodega',
  // históricos FoxPro
  'MARIA': 'María', 'ALEJA': 'Aleja', 'LAURA': 'Laura', 'CLAUDIA': 'Claudia',
}

const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const ayer = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

export default function CierreCaja({ supabase, onClose }) {
  const [desde,    setDesde]    = useState(hoy())
  const [hasta,    setHasta]    = useState(hoy())
  const [datos,    setDatos]    = useState(null)
  const [cargando, setCargando] = useState(false)
  const [tab,      setTab]      = useState('consolidado')

  async function generar() {
    setCargando(true)
    try {
      const {data:notas} = await supabase.from('encnotaen')
        .select('numnotaent,fechanotae,nombreclie,cedrifclie,cedvended,valtotal,valabono,saldo,formapago,mediopago,cantotal,codclient,usuario')
        .gte('fechanotae', desde).lte('fechanotae', hasta)
        .or('anulada.is.null,anulada.neq.S')

      const numNotas = (notas||[]).map(n => n.numnotaent)
      let detalle = []
      if (numNotas.length > 0) {
        const {data:det} = await supabase.from('detnotaen')
          .select('numnotaent,codartic,descartic,marca,cantidad,valunit,valtotal')
          .in('numnotaent', numNotas)
        detalle = det||[]
      }

      const {data:vends} = await supabase.from('vendedores').select('cedula,nombre')
      const vendMap = {}
      ;(vends||[]).forEach(v => { vendMap[String(v.cedula)] = v.nombre })

      const {data:notasAyer} = await supabase.from('encnotaen')
        .select('valtotal').gte('fechanotae', ayer()).lte('fechanotae', ayer())
        .or('anulada.is.null,anulada.neq.S')

      const {data:abonos} = await supabase.from('detabonos')
        .select('numnotaent,valabono,mediopago,fechaabono,cedvended,usuario')
        .gte('fechaabono', desde).lte('fechaabono', hasta)

      const {data:carteraTotal} = await supabase.from('encnotaen')
        .select('saldo').or('anulada.is.null,anulada.neq.S').gt('saldo', 0)
      const totalCarteraGlobal = (carteraTotal||[]).reduce((s,n) => s+(n.saldo||0), 0)

      setDatos({ notas:notas||[], detalle, vendMap, abonos:abonos||[], notasAyer:notasAyer||[], totalCarteraGlobal })
    } catch(e) { console.error(e) }
    setCargando(false)
  }

  // ── CONSOLIDADO ──────────────────────────────────────────────────────────
  // porVendedor: agrupa por cedvended (quién vendió)
  // porCaja: agrupa por usuario (en qué caja se registró)
  function calcConsolidado() {
    if (!datos) return null
    const { notas, vendMap } = datos

    const porVendedor = {}   // cedvended → totales
    const porCaja     = {}   // usuario   → totales
    const totales     = { efectivo:0, transferencia:0, mixto:0, credito:0, noAbonado:0, total:0, notas:0 }

    const acum = (obj, key, n) => {
      if (!obj[key]) obj[key] = { efectivo:0, transferencia:0, mixto:0, credito:0, noAbonado:0, total:0, notas:0 }
      const v     = obj[key]
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      const val   = n.valtotal||0
      if (esC) { v.credito += n.valabono||0; v.noAbonado += n.saldo||0 }
      else {
        if (medio==='efectivo')           v.efectivo      += val
        else if (medio==='transferencia') v.transferencia += val
        else if (medio==='mixto')         v.mixto         += val
        else                              v.efectivo      += val
      }
      v.total += val
      v.notas++
    }

    notas.forEach(n => {
      const cedv  = String(n.cedvended||'')
      const usu   = (n.usuario||'').trim()
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      const val   = n.valtotal||0

      // Por vendedor (cedvended)
      const nomVend = cedv ? (vendMap[cedv] || `Vendedor ${cedv}`) : 'Sin vendedor'
      acum(porVendedor, nomVend, n)

      // Por caja (usuario)
      const nomCaja = LABEL_CAJA[usu] || usu || 'Sin caja'
      acum(porCaja, nomCaja, n)

      // Totales generales
      totales.total += val
      totales.notas++
      if (esC) { totales.credito += n.valabono||0; totales.noAbonado += n.saldo||0 }
      else {
        if (medio==='efectivo')           totales.efectivo      += val
        else if (medio==='transferencia') totales.transferencia += val
        else if (medio==='mixto')         totales.mixto         += val
        else                              totales.efectivo      += val
      }
    })

    // Separar vendedores externos de vendedoras de mostrador
    const vendExterno  = {}
    const vendMostrador = {}
    Object.entries(porVendedor).forEach(([nom, v]) => {
      // Buscar la cédula original para saber si es externo
      const cedv = Object.keys(vendMap).find(k => vendMap[k] === nom) || ''
      if (esVendedorExterno(cedv)) vendExterno[nom] = v
      else vendMostrador[nom] = v
    })

    return { porVendedor, vendMostrador, vendExterno, porCaja, totales }
  }

  // ── VENTAS POR MARCA ──────────────────────────────────────────────────────
  function calcMarcas() {
    if (!datos) return null
    const porMarca = {}
    datos.detalle.forEach(d => {
      const marca = (d.marca||'').trim() || 'SIN MARCA'
      if (!porMarca[marca]) porMarca[marca] = { unidades:0, total:0 }
      porMarca[marca].unidades += Number(d.cantidad)||0
      porMarca[marca].total    += Number(d.valtotal)||0
    })
    return porMarca
  }

  // ── RESUMEN DEL DÍA ───────────────────────────────────────────────────────
  function calcResumen() {
    if (!datos) return null
    const { notas, abonos, notasAyer } = datos

    let totalVentas=0, totalCredito=0, totalContado=0
    let totalEfectivo=0, totalTransferencia=0, totalMixto=0

    notas.forEach(n => {
      const val   = n.valtotal||0
      const medio = normMedio(n.mediopago)
      const esC   = n.formapago !== 'CONTADO' && (n.saldo||0) > 0
      totalVentas += val
      if (esC) { totalCredito += val }
      else {
        totalContado += val
        if (medio==='efectivo')           totalEfectivo      += val
        else if (medio==='transferencia') totalTransferencia += val
        else if (medio==='mixto')         totalMixto         += val
        else                              totalEfectivo      += val
      }
    })

    const totalAbonosCredito = abonos.reduce((s,a) => s+(a.valabono||0), 0)
    const totalAyer          = notasAyer.reduce((s,n) => s+(n.valtotal||0), 0)
    const totalIngresado     = totalEfectivo + totalTransferencia + totalMixto + totalAbonosCredito

    return {
      totalVentas, totalCredito, totalContado,
      totalEfectivo, totalTransferencia, totalMixto,
      totalIngresado, totalAbonosCredito, totalAyer,
      totalPendiente: datos.totalCarteraGlobal||0,
      cantNotas: notas.length
    }
  }

  // ── TOP ARTÍCULOS ─────────────────────────────────────────────────────────
  function calcTopArticulos() {
    if (!datos) return []
    const map = {}
    datos.detalle.forEach(d => {
      if (!map[d.codartic]) map[d.codartic] = { codartic:d.codartic, descartic:d.descartic, unidades:0, total:0 }
      map[d.codartic].unidades += Number(d.cantidad)||0
      map[d.codartic].total    += Number(d.valtotal)||0
    })
    return Object.values(map).sort((a,b) => b.total-a.total).slice(0,10)
  }

  // ── CARTERA ───────────────────────────────────────────────────────────────
  function calcCartera() {
    if (!datos) return []
    return datos.notas.filter(n => n.saldo>0)
      .sort((a,b) => a.fechanotae.localeCompare(b.fechanotae))
      .map(n => ({...n, diasVencido: Math.floor((new Date()-new Date(n.fechanotae))/(1000*60*60*24))}))
  }

  // ── VENTAS POR CLIENTE ────────────────────────────────────────────────────
  function calcVentasCliente() {
    if (!datos) return { mostrador:[], clientes:[], totMostrador:0 }
    const MOSTRADOR = ['99','9','999','5031']
    const esMost = n => MOSTRADOR.includes(String(n.codclient||'').trim()) || MOSTRADOR.includes(String(n.cedrifclie||'').trim())
    const mostrador = datos.notas.filter(esMost)
    const clientes  = datos.notas.filter(n => !esMost(n))
    const map = {}
    clientes.forEach(n => {
      const k = String(n.cedrifclie||n.codclient||'?')
      if (!map[k]) map[k] = { cedula:k, nombre:n.nombreclie, notas:0, total:0, abonado:0, saldo:0 }
      map[k].notas++; map[k].total += n.valtotal||0; map[k].abonado += n.valabono||0; map[k].saldo += n.saldo||0
    })
    return { mostrador, clientes:Object.values(map).sort((a,b)=>b.total-a.total), totMostrador:mostrador.reduce((s,n)=>s+(n.valtotal||0),0) }
  }

  const cons      = calcConsolidado()
  const marcas    = calcMarcas()
  const resumen   = calcResumen()
  const topArts   = calcTopArticulos()
  const cartera   = calcCartera()
  const ventasCli = calcVentasCliente()

  // ── HELPERS IMPRESIÓN ─────────────────────────────────────────────────────
  const estilosImp = `
    body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
    h2,h3{color:#1a3a6b;text-align:center;margin:8px 0;}
    .sub{text-align:center;color:#555;margin-bottom:12px;}
    table{width:100%;border-collapse:collapse;margin-bottom:18px;}
    th{background:#1a3a6b;color:#fff;padding:6px 8px;text-align:right;font-size:10px;}
    th:first-child{text-align:left;}
    td{padding:5px 8px;border-bottom:1px solid #eee;text-align:right;}
    td:first-child{text-align:left;}
    tr:nth-child(even){background:#f5f7fc;}
    .tot{font-weight:900;background:#dde3ee!important;}
    .sec{background:#e8eaf6;font-weight:700;font-size:11px;}
    @media print{body{padding:8px;}}
  `

  const filaTabla = (nom, v) => `
    <tr>
      <td>${nom}</td>
      <td>${v.notas}</td>
      <td>${v.efectivo?'$'+fmt(v.efectivo):''}</td>
      <td>${v.transferencia?'$'+fmt(v.transferencia):''}</td>
      <td>${v.mixto?'$'+fmt(v.mixto):''}</td>
      <td>${v.credito?'$'+fmt(v.credito):''}</td>
      <td style="color:#c62828">${v.noAbonado?'$'+fmt(v.noAbonado):''}</td>
      <td><b>$${fmt(v.total)}</b></td>
    </tr>`

  const cabeceraTabla = (titulo) => `
    <tr class="sec"><td colspan="8">${titulo}</td></tr>
    <tr style="background:#1a3a6b">
      <th style="text-align:left">NOMBRE</th><th>NOTAS</th><th>EFECTIVO</th>
      <th>TRANSF.</th><th>MIXTO</th><th>CRÉDITO</th><th>NO ABONADO</th><th>TOTAL</th>
    </tr>`

  function imprimirConsolidado() {
    if (!cons) return
    const w = window.open('','_blank','width=1000,height=700')
    w.document.write(`<html><head><title>Consolidado</title><style>${estilosImp}</style></head><body>
    <h2>ATM — CONSOLIDADO DE MOVIMIENTOS</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table>
      <tbody>
        ${cabeceraTabla('VENTAS POR VENDEDORA DE MOSTRADOR')}
        ${Object.entries(cons.vendMostrador).sort((a,b)=>b[1].total-a[1].total).map(([n,v])=>filaTabla(n,v)).join('')}
        ${Object.keys(cons.vendExterno).length ? cabeceraTabla('VENTAS POR VENDEDOR EXTERNO') + Object.entries(cons.vendExterno).map(([n,v])=>filaTabla(n,v)).join('') : ''}
        ${cabeceraTabla('TOTALES POR CAJA')}
        ${Object.entries(cons.porCaja).map(([n,v])=>filaTabla(n,v)).join('')}
        <tr class="tot">
          <td>TOTALES GENERALES</td>
          <td>${cons.totales.notas}</td>
          <td>${cons.totales.efectivo?'$'+fmt(cons.totales.efectivo):''}</td>
          <td>${cons.totales.transferencia?'$'+fmt(cons.totales.transferencia):''}</td>
          <td>${cons.totales.mixto?'$'+fmt(cons.totales.mixto):''}</td>
          <td>${cons.totales.credito?'$'+fmt(cons.totales.credito):''}</td>
          <td style="color:#c62828">${cons.totales.noAbonado?'$'+fmt(cons.totales.noAbonado):''}</td>
          <td><b>$${fmt(cons.totales.total)}</b></td>
        </tr>
      </tbody>
    </table>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirMarcas() {
    if (!marcas) return
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><title>Marcas</title><style>${estilosImp}</style></head><body>
    <h2>ATM — VENTAS POR MARCA</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table><thead><tr><th style="text-align:left">Marca</th><th>Unidades</th><th>$ Promedio</th><th>$ Total</th></tr></thead><tbody>
    ${Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v])=>`
      <tr><td>${m}</td><td>${v.unidades}</td><td>$${fmt(v.unidades>0?v.total/v.unidades:0)}</td><td>$${fmt(v.total)}</td></tr>`).join('')}
    <tr class="tot"><td>TOTALES</td><td>${Object.values(marcas).reduce((s,v)=>s+v.unidades,0)}</td><td></td>
    <td>$${fmt(Object.values(marcas).reduce((s,v)=>s+v.total,0))}</td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirTop() {
    const w = window.open('','_blank','width=700,height=500')
    w.document.write(`<html><head><title>Top</title><style>${estilosImp}</style></head><body>
    <h2>ATM — TOP 10 ARTÍCULOS</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table><thead><tr><th style="text-align:left">#</th><th style="text-align:left">Código</th><th style="text-align:left">Descripción</th><th>Unidades</th><th>$ Total</th></tr></thead><tbody>
    ${topArts.map((a,i)=>`<tr><td>${i+1}</td><td>${a.codartic}</td><td>${a.descartic}</td><td>${a.unidades}</td><td>$${fmt(a.total)}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirCartera() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><title>Cartera</title><style>${estilosImp}.mora{color:#c62828;font-weight:700;}</style></head><body>
    <h2>ATM — CARTERA PENDIENTE</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <table><thead><tr><th style="text-align:left">Nota</th><th style="text-align:left">Fecha</th><th style="text-align:left">Cliente</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Días</th></tr></thead><tbody>
    ${cartera.map(n=>`<tr><td>${n.numnotaent}</td><td>${n.fechanotae}</td><td>${n.nombreclie}</td>
      <td>$${fmt(n.valtotal)}</td><td>$${fmt(n.valabono)}</td>
      <td style="color:#c62828;font-weight:700">$${fmt(n.saldo)}</td>
      <td class="${n.diasVencido>30?'mora':''}">${n.diasVencido}d</td></tr>`).join('')}
    <tr class="tot"><td colspan="5">TOTAL PENDIENTE</td><td>$${fmt(cartera.reduce((s,n)=>s+n.saldo,0))}</td><td></td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirVentasCliente() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><title>Clientes</title><style>${estilosImp}</style></head><body>
    <h2>ATM — VENTAS POR CLIENTE</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <div class="sec" style="padding:5px 8px;margin-bottom:4px">VENTAS MOSTRADOR — $${fmt(ventasCli.totMostrador)} (${ventasCli.mostrador.length} notas)</div>
    <div class="sec" style="padding:5px 8px;margin-bottom:4px;margin-top:12px">VENTAS A CLIENTES ESPECÍFICOS</div>
    <table><thead><tr><th style="text-align:left">Cédula</th><th style="text-align:left">Cliente</th><th>Notas</th><th>Total</th><th>Abonado</th><th>Saldo</th></tr></thead><tbody>
    ${ventasCli.clientes.map(cl=>`<tr><td>${cl.cedula}</td><td>${cl.nombre}</td><td>${cl.notas}</td>
      <td>$${fmt(cl.total)}</td><td>$${fmt(cl.abonado)}</td><td style="color:#c62828">$${fmt(cl.saldo)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTALES</td>
    <td>$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.total,0))}</td>
    <td>$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.abonado,0))}</td>
    <td style="color:#c62828">$${fmt(ventasCli.clientes.reduce((s,c)=>s+c.saldo,0))}</td></tr>
    </tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirResumen() {
    if (!resumen) return
    const w = window.open('','_blank','width=700,height=600')
    w.document.write(`<html><head><title>Resumen</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}
    h2{color:#1a3a6b;text-align:center;}.sub{text-align:center;color:#555;margin-bottom:16px;}
    .f{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #eee;}
    .f.tot{font-weight:900;font-size:14px;background:#dde3ee;border-top:2px solid #1a3a6b;}
    .lbl{color:#333;}.val{color:#1a3a6b;font-weight:700;}
    @media print{body{padding:8px;}}</style></head><body>
    <h2>RESUMEN DE VENTAS DIARIAS</h2>
    <div class="sub">DESDE ${desde} &nbsp;&nbsp; HASTA ${hasta}</div>
    <div class="f"><span class="lbl">Notas generadas</span><span class="val">${resumen.cantNotas}</span></div>
    <div class="f tot"><span class="lbl">VENTAS TOTALES</span><span class="val">$${fmt(resumen.totalVentas)}</span></div>
    <div class="f"><span class="lbl">Ventas a crédito</span><span class="val">$${fmt(resumen.totalCredito)}</span></div>
    <div class="f"><span class="lbl">Ventas de contado</span><span class="val">$${fmt(resumen.totalContado)}</span></div>
    <div class="f"><span class="lbl">Ingresos en efectivo</span><span class="val">$${fmt(resumen.totalEfectivo)}</span></div>
    <div class="f"><span class="lbl">Ingresos en transferencia</span><span class="val">$${fmt(resumen.totalTransferencia)}</span></div>
    <div class="f"><span class="lbl">Ingresos en mixto</span><span class="val">$${fmt(resumen.totalMixto)}</span></div>
    <div class="f"><span class="lbl">Abonos a créditos recibidos</span><span class="val">$${fmt(resumen.totalAbonosCredito)}</span></div>
    <div class="f tot"><span class="lbl">TOTAL DINERO INGRESADO</span><span class="val">$${fmt(resumen.totalIngresado)}</span></div>
    <div class="f"><span class="lbl" style="color:#c62828">Saldo pendiente por cobrar</span><span class="val" style="color:#c62828">$${fmt(resumen.totalPendiente)}</span></div>
    <div class="f"><span class="lbl">Ventas día anterior</span><span class="val">$${fmt(resumen.totalAyer)}</span></div>
    <div class="f"><span class="lbl" style="color:${resumen.totalVentas>=resumen.totalAyer?'#2e7d32':'#c62828'}">
      ${resumen.totalVentas>=resumen.totalAyer?'▲ MEJOR QUE AYER':'▼ MENOR QUE AYER'}
      (${resumen.totalAyer>0?Math.round((resumen.totalVentas-resumen.totalAyer)/resumen.totalAyer*100):0}%)
    </span><span></span></div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const TABS = [
    {id:'consolidado', label:'📊 Consolidado'},
    {id:'marcas',      label:'🏷️ Ventas por Marca'},
    {id:'clientes',    label:'👥 Ventas por Cliente'},
    {id:'resumen',     label:'💰 Resumen del Día'},
    {id:'top',         label:'🏆 Top Artículos'},
    {id:'cartera',     label:'📋 Cartera Pendiente'},
  ]

  const TablaConsolidado = ({ titulo, datos: filas, icono }) => (
    <div style={{marginBottom:24}}>
      <div style={P.secTit}>{icono} {titulo} — {desde} al {hasta}</div>
      <table style={P.tabla}>
        <thead>
          <tr style={P.thead}>
            {['Nombre','Notas','Efectivo','Transferencia','Mixto','Crédito','No Abonado','Total'].map(h=>(
              <th key={h} style={{...P.th, textAlign:h==='Nombre'?'left':'right'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(filas).sort((a,b)=>b[1].total-a[1].total).map(([nom,v],i)=>(
            <tr key={nom} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
              <td style={{...P.td,fontWeight:600}}>{nom}</td>
              <td style={{...P.td,textAlign:'right',color:'#555'}}>{v.notas}</td>
              <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>{v.efectivo?`$${fmt(v.efectivo)}`:''}</td>
              <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>{v.transferencia?`$${fmt(v.transferencia)}`:''}</td>
              <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>{v.mixto?`$${fmt(v.mixto)}`:''}</td>
              <td style={{...P.td,textAlign:'right',color:'#e65100'}}>{v.credito?`$${fmt(v.credito)}`:''}</td>
              <td style={{...P.td,textAlign:'right',color:'#c62828'}}>{v.noAbonado?`$${fmt(v.noAbonado)}`:''}</td>
              <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</td>
            </tr>
          ))}
          {Object.keys(filas).length===0 && (
            <tr><td colSpan={8} style={{textAlign:'center',padding:16,color:'#aaa'}}>Sin datos en este período.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>CIERRE DE CAJA / INFORMES</span>
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        <div style={P.filtros}>
          <label style={P.lbl}>Desde<input type="date" style={P.inp} value={desde} onChange={e=>setDesde(e.target.value)}/></label>
          <label style={P.lbl}>Hasta<input type="date" style={P.inp} value={hasta} onChange={e=>setHasta(e.target.value)}/></label>
          <button onClick={generar} disabled={cargando} style={P.btnGenerar}>
            {cargando ? '⏳ Calculando…' : '🔍 Generar Informes'}
          </button>
          {datos && (
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              {tab==='consolidado' && <button onClick={imprimirConsolidado} style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='marcas'      && <button onClick={imprimirMarcas}      style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='clientes'    && <button onClick={imprimirVentasCliente} style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='resumen'     && <button onClick={imprimirResumen}     style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='top'         && <button onClick={imprimirTop}         style={P.btnPrint}>🖨 Imprimir</button>}
              {tab==='cartera'     && <button onClick={imprimirCartera}     style={P.btnPrint}>🖨 Imprimir</button>}
            </div>
          )}
        </div>

        {!datos && !cargando && (
          <div style={{textAlign:'center',padding:60,color:'#aab8d4',fontSize:14}}>
            Selecciona el rango de fechas y presiona <strong>Generar Informes</strong>
          </div>
        )}
        {cargando && <div style={{textAlign:'center',padding:60,color:'#1a3a6b',fontSize:14}}>⏳ Cargando datos…</div>}

        {datos && !cargando && (
          <>
            <div style={P.tabs}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{...P.tab,...(tab===t.id?P.tabActivo:{})}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={P.contenido}>

              {/* ── CONSOLIDADO ── */}
              {tab==='consolidado' && cons && (
                <div>
                  <TablaConsolidado titulo="Ventas por Vendedora de Mostrador" icono="👗" datos={cons.vendMostrador} />
                  {Object.keys(cons.vendExterno).length > 0 && (
                    <TablaConsolidado titulo="Ventas por Vendedor Externo" icono="👤" datos={cons.vendExterno} />
                  )}
                  <TablaConsolidado titulo="Totales por Caja" icono="🏧" datos={cons.porCaja} />

                  {/* Fila de totales generales */}
                  <div style={P.secTit}>📊 Totales Generales</div>
                  <table style={P.tabla}>
                    <tbody>
                      <tr style={P.totRow}>
                        <td style={{...P.td,width:'25%'}}><strong>TOTALES GENERALES</strong></td>
                        <td style={{...P.td,textAlign:'right'}}>{cons.totales.notas} notas</td>
                        <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(cons.totales.efectivo)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#1565c0'}}>${fmt(cons.totales.transferencia)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#6a1b9a'}}>${fmt(cons.totales.mixto)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#e65100'}}>${fmt(cons.totales.credito)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#c62828'}}>${fmt(cons.totales.noAbonado)}</td>
                        <td style={{...P.td,textAlign:'right',fontSize:15,color:'#1a3a6b'}}><strong>${fmt(cons.totales.total)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VENTAS POR MARCA ── */}
              {tab==='marcas' && marcas && (
                <div>
                  <div style={P.secTit}>🏷️ Ventas por Marca — {desde} al {hasta}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Marca','Unidades','$ Promedio','$ Total'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:h==='Marca'?'left':'right'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(marcas).sort((a,b)=>b[1].total-a[1].total).map(([m,v],i)=>(
                        <tr key={m} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,fontWeight:600}}>{m}</td>
                          <td style={{...P.td,textAlign:'right'}}>{v.unidades}</td>
                          <td style={{...P.td,textAlign:'right'}}>${fmt(v.unidades>0?v.total/v.unidades:0)}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(v.total)}</td>
                        </tr>
                      ))}
                      <tr style={P.totRow}>
                        <td style={P.td}><strong>TOTALES</strong></td>
                        <td style={{...P.td,textAlign:'right'}}>{Object.values(marcas).reduce((s,v)=>s+v.unidades,0)}</td>
                        <td style={P.td}></td>
                        <td style={{...P.td,textAlign:'right',fontSize:14,color:'#1a3a6b'}}><strong>${fmt(Object.values(marcas).reduce((s,v)=>s+v.total,0))}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── RESUMEN DEL DÍA ── */}
              {tab==='resumen' && resumen && (
                <div style={{maxWidth:600}}>
                  <div style={P.secTit}>💰 Resumen del Día — {desde} al {hasta}</div>
                  {[
                    {lbl:'Notas generadas',                          val:resumen.cantNotas},
                    {lbl:'Ventas totales (contado + crédito)',        val:`$${fmt(resumen.totalVentas)}`,        grande:true},
                    {lbl:'Ventas a crédito',                          val:`$${fmt(resumen.totalCredito)}`},
                    {lbl:'Ventas de contado',                         val:`$${fmt(resumen.totalContado)}`},
                    {lbl:'Ingresos en efectivo',                      val:`$${fmt(resumen.totalEfectivo)}`},
                    {lbl:'Ingresos en transferencia',                 val:`$${fmt(resumen.totalTransferencia)}`},
                    {lbl:'Ingresos en mixto',                         val:`$${fmt(resumen.totalMixto)}`},
                    {lbl:'Abonos a créditos recibidos hoy',           val:`$${fmt(resumen.totalAbonosCredito)}`},
                    {lbl:'TOTAL DINERO INGRESADO',                    val:`$${fmt(resumen.totalIngresado)}`,     grande:true, color:'#1a3a6b'},
                    {lbl:'Saldo pendiente por cobrar',                val:`$${fmt(resumen.totalPendiente)}`,    color:'#c62828'},
                    {lbl:'Ventas día anterior',                       val:`$${fmt(resumen.totalAyer)}`},
                    {lbl:resumen.totalVentas>=resumen.totalAyer?'▲ Mejor que ayer':'▼ Menor que ayer',
                     val:`${resumen.totalAyer>0?Math.round((resumen.totalVentas-resumen.totalAyer)/resumen.totalAyer*100):0}%`,
                     color:resumen.totalVentas>=resumen.totalAyer?'#2e7d32':'#c62828'},
                  ].map((r,i)=>(
                    <div key={i} style={{...P.resumenFila,background:r.grande?'#eef2ff':'#fff',borderTop:r.grande?'2px solid #1a3a6b':'none'}}>
                      <span style={{fontSize:r.grande?13:12,fontWeight:r.grande?800:500,color:'#333'}}>{r.lbl}</span>
                      <span style={{fontSize:r.grande?16:13,fontWeight:700,color:r.color||'#1a3a6b'}}>{r.val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TOP ARTÍCULOS ── */}
              {tab==='top' && (
                <div>
                  <div style={P.secTit}>🏆 Top 10 Artículos — {desde} al {hasta}</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['#','Código','Descripción','Unidades','$ Total'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Unidades','$ Total'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topArts.map((a,i)=>(
                        <tr key={a.codartic} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,color:'#aaa',fontWeight:700}}>{i+1}</td>
                          <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{a.codartic}</td>
                          <td style={P.td}>{a.descartic}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:600}}>{a.unidades}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(a.total)}</td>
                        </tr>
                      ))}
                      {topArts.length===0 && <tr><td colSpan={5} style={{textAlign:'center',padding:20,color:'#888'}}>Sin ventas en el período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── VENTAS POR CLIENTE ── */}
              {tab==='clientes' && ventasCli && (
                <div>
                  <div style={P.secTit}>👥 Ventas por Cliente — {desde} al {hasta}</div>
                  <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:8,fontWeight:700,fontSize:13}}>
                    VENTAS MOSTRADOR (CLIENTE GENERAL) — ${fmt(ventasCli.totMostrador)}
                    <span style={{marginLeft:16,fontSize:11,fontWeight:400,opacity:0.8}}>{ventasCli.mostrador.length} notas</span>
                  </div>
                  <div style={{background:'#1a3a6b',color:'#fff',padding:'6px 12px',borderRadius:5,marginBottom:8,marginTop:16,fontWeight:700,fontSize:13}}>
                    VENTAS A CLIENTES ESPECÍFICOS
                  </div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Cédula','Cliente','Notas','Total','Abonado','Saldo'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Notas','Total','Abonado','Saldo'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ventasCli.clientes.map((cl,i)=>(
                        <tr key={cl.cedula} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={P.td}>{cl.cedula}</td>
                          <td style={{...P.td,fontWeight:600}}>{cl.nombre}</td>
                          <td style={{...P.td,textAlign:'right'}}>{cl.notas}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#1a3a6b'}}>${fmt(cl.total)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(cl.abonado)}</td>
                          <td style={{...P.td,textAlign:'right',color:cl.saldo>0?'#c62828':'#2e7d32',fontWeight:700}}>${fmt(cl.saldo)}</td>
                        </tr>
                      ))}
                      {ventasCli.clientes.length>0 && (
                        <tr style={P.totRow}>
                          <td colSpan={3} style={P.td}><strong>TOTALES</strong></td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#1a3a6b'}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.total,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.abonado,0))}</td>
                          <td style={{...P.td,textAlign:'right',color:'#c62828',fontSize:14}}>${fmt(ventasCli.clientes.reduce((s,c)=>s+c.saldo,0))}</td>
                        </tr>
                      )}
                      {ventasCli.clientes.length===0 && <tr><td colSpan={6} style={{textAlign:'center',padding:20,color:'#888'}}>Sin ventas a clientes específicos.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── CARTERA PENDIENTE ── */}
              {tab==='cartera' && (
                <div>
                  <div style={P.secTit}>📋 Cartera Pendiente — Notas con saldo sin pagar</div>
                  <table style={P.tabla}>
                    <thead>
                      <tr style={P.thead}>
                        {['Nota','Fecha','Cliente','Total','Abonado','Saldo','Días'].map(h=>(
                          <th key={h} style={{...P.th,textAlign:['Total','Abonado','Saldo','Días'].includes(h)?'right':'left'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cartera.map((n,i)=>(
                        <tr key={n.numnotaent} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                          <td style={P.td}>{n.fechanotae}</td>
                          <td style={P.td}>{n.nombreclie}</td>
                          <td style={{...P.td,textAlign:'right'}}>${fmt(n.valtotal)}</td>
                          <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(n.valabono)}</td>
                          <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>${fmt(n.saldo)}</td>
                          <td style={{...P.td,textAlign:'right',color:n.diasVencido>30?'#c62828':n.diasVencido>15?'#e65100':'#555'}}>{n.diasVencido}d</td>
                        </tr>
                      ))}
                      {cartera.length>0 && (
                        <tr style={P.totRow}>
                          <td colSpan={5} style={P.td}><strong>TOTAL PENDIENTE</strong></td>
                          <td style={{...P.td,textAlign:'right',fontSize:14,color:'#c62828'}}>${fmt(cartera.reduce((s,n)=>s+n.saldo,0))}</td>
                          <td style={P.td}></td>
                        </tr>
                      )}
                      {cartera.length===0 && <tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#2e7d32',fontWeight:700}}>✅ Sin cartera pendiente en este período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}

const P={
  pagina:     {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:    {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden',display:'flex',flexDirection:'column'},
  titulo:     {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt:    {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:     {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  btnCerrar:  {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  filtros:    {display:'flex',gap:12,alignItems:'flex-end',padding:'10px 14px',background:'#fff',borderBottom:'1px solid #c8d5ea',flexWrap:'wrap'},
  lbl:        {display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:        {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none'},
  btnGenerar: {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 20px',cursor:'pointer',fontWeight:700,fontSize:13,height:32},
  btnPrint:   {background:'#2e7d32',color:'#fff',border:'none',borderRadius:5,padding:'0 14px',cursor:'pointer',fontWeight:700,fontSize:12,height:32},
  tabs:       {display:'flex',gap:0,background:'#dde3ee',borderBottom:'2px solid #8fa4c8',overflowX:'auto'},
  tab:        {padding:'9px 16px',cursor:'pointer',fontSize:12,fontWeight:600,color:'#5577aa',border:'none',background:'transparent',whiteSpace:'nowrap',borderBottom:'3px solid transparent'},
  tabActivo:  {color:'#1a3a6b',fontWeight:800,borderBottom:'3px solid #1a3a6b',background:'#fff'},
  contenido:  {padding:'14px 16px',overflowY:'auto',flex:1,maxHeight:'calc(100vh - 200px)'},
  secTit:     {fontSize:14,fontWeight:800,color:'#1a3a6b',marginBottom:10,paddingBottom:6,borderBottom:'2px solid #c8d5ea'},
  tabla:      {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:      {background:'#1a3a6b',position:'sticky',top:0},
  th:         {padding:'7px 10px',color:'#fff',fontWeight:700,fontSize:11,whiteSpace:'nowrap'},
  td:         {padding:'6px 10px',borderBottom:'1px solid #eee',fontSize:12},
  totRow:     {background:'#dde3ee',fontWeight:900},
  resumenFila:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid #eee',borderRadius:4,marginBottom:2},
}
