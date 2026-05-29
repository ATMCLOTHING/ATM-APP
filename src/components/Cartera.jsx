import { useState, useEffect } from 'react'
import { WZCLOSE, WZPRINT, WZLOCATE } from '../lib/assets'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const hoy = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
const diasDesde = fecha => Math.floor((new Date()-new Date(fecha))/(1000*60*60*24))

export default function Cartera({ supabase, usuario, onClose }) {
  const [vendedores,  setVendedores]  = useState([])
  const [filtVend,    setFiltVend]    = useState('')
  const [filtCliente, setFiltCliente] = useState('')
  const [filtMora,    setFiltMora]    = useState('todos') // todos|mora30|mora60|mora90
  const [filtEstado,  setFiltEstado]  = useState('pendiente') // pendiente|pagada|todas
  const [notas,       setNotas]       = useState([])
  const [cargando,    setCargando]    = useState(false)
  const [tab,         setTab]         = useState('resumen')
  const [generado,    setGenerado]    = useState(false)

  useEffect(()=>{
    supabase.from('vendedores').select('cedula,nombre').order('nombre')
      .then(({data})=>setVendedores(data||[]))
    // Si es vendedor, preseleccionar su cédula
    if (usuario?.rol==='vendedor' && usuario?.cedula_vendedor) {
      setFiltVend(usuario.cedula_vendedor)
    }
  },[])

  async function generar() {
    setCargando(true)
    let q = supabase.from('encnotaen')
      .select('numnotaent,fechanotae,fechavence,cedrifclie,nombreclie,cedvended,valtotal,valabono,saldo,formapago,mediopago,anulada')
      .eq('anulada','N')
      .order('fechanotae',{ascending:true})

    // Filtro por vendedor
    if (filtVend) q = q.eq('cedvended', filtVend)
    else if (usuario?.rol==='vendedor' && usuario?.cedula_vendedor) {
      q = q.eq('cedvended', usuario.cedula_vendedor)
    }

    // Filtro por estado
    if (filtEstado==='pendiente') q = q.gt('saldo',0)
    else if (filtEstado==='pagada') q = q.eq('saldo',0)

    // Filtro por cliente
    if (filtCliente.trim()) q = q.ilike('nombreclie',`%${filtCliente.trim()}%`)

    const {data} = await q
    let resultado = (data||[]).map(n=>({
      ...n,
      diasNota:    diasDesde(n.fechanotae),
      diasVencido: n.fechavence ? Math.max(0,diasDesde(n.fechavence)) : diasDesde(n.fechanotae)
    }))

    // Filtro mora
    if (filtMora==='mora30') resultado = resultado.filter(n=>n.diasVencido>=30)
    else if (filtMora==='mora60') resultado = resultado.filter(n=>n.diasVencido>=60)
    else if (filtMora==='mora90') resultado = resultado.filter(n=>n.diasVencido>=90)

    setNotas(resultado)
    setGenerado(true)
    setCargando(false)
  }

  // Agrupar por cliente para resumen
  function calcResumen() {
    const map = {}
    notas.forEach(n=>{
      const k = n.cedrifclie||'SIN CEDULA'
      if (!map[k]) map[k]={cedula:k,nombre:n.nombreclie,notas:0,valor:0,abonado:0,saldo:0,maxDias:0}
      map[k].notas++
      map[k].valor   += n.valtotal||0
      map[k].abonado += n.valabono||0
      map[k].saldo   += n.saldo||0
      map[k].maxDias  = Math.max(map[k].maxDias, n.diasVencido)
    })
    return Object.values(map).sort((a,b)=>b.saldo-a.saldo)
  }

  const resumen = calcResumen()
  const totales = {
    valor:   notas.reduce((s,n)=>s+(n.valtotal||0),0),
    abonado: notas.reduce((s,n)=>s+(n.valabono||0),0),
    saldo:   notas.reduce((s,n)=>s+(n.saldo||0),0),
  }

  const nomVend = filtVend ? (vendedores.find(v=>v.cedula===filtVend)?.nombre||filtVend) : 'Todos'

  function colorMora(dias) {
    if (dias>=90) return '#c62828'
    if (dias>=60) return '#e65100'
    if (dias>=30) return '#f57f17'
    return '#2e7d32'
  }

  function imprimirResumen() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`<html><head><title>Cartera</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
      h2{color:#1a3a6b;text-align:center;margin-bottom:4px;}
      .sub{text-align:center;color:#555;margin-bottom:12px;font-size:10px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{background:#1a3a6b;color:#fff;padding:5px 8px;text-align:left;font-size:10px;}
      td{padding:4px 8px;border-bottom:1px solid #eee;font-size:11px;}
      tr:nth-child(even){background:#f5f7fc;}
      .tot{font-weight:900;background:#dde3ee;}
      .mora30{color:#f57f17;font-weight:700;}
      .mora60{color:#e65100;font-weight:700;}
      .mora90{color:#c62828;font-weight:700;}
      @media print{body{padding:8px;}}
    </style></head><body>
    <h2>ATM — CARTERA VIGENTE</h2>
    <div class="sub">Vendedor: ${nomVend} &nbsp;|&nbsp; Fecha: ${hoy()} &nbsp;|&nbsp; ${resumen.length} clientes</div>
    <table>
      <thead><tr>
        <th>Cédula</th><th>Cliente</th><th style="text-align:right">$ Valor</th>
        <th style="text-align:right">$ Saldo</th><th style="text-align:right">Abonos</th><th style="text-align:right">Días</th>
      </tr></thead>
      <tbody>
        ${resumen.map(c=>`
          <tr>
            <td>${c.cedula}</td><td>${c.nombre}</td>
            <td style="text-align:right">$${fmt(c.valor)}</td>
            <td style="text-align:right;font-weight:700">$${fmt(c.saldo)}</td>
            <td style="text-align:right">$${fmt(c.abonado)}</td>
            <td style="text-align:right" class="${c.maxDias>=90?'mora90':c.maxDias>=60?'mora60':c.maxDias>=30?'mora30':''}">${c.maxDias}d</td>
          </tr>`).join('')}
        <tr class="tot">
          <td colspan="2">TOTALES — ${resumen.length} clientes</td>
          <td style="text-align:right">$${fmt(totales.valor)}</td>
          <td style="text-align:right">$${fmt(totales.saldo)}</td>
          <td style="text-align:right">$${fmt(totales.abonado)}</td><td></td>
        </tr>
      </tbody>
    </table>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  function imprimirDetalle() {
    const w = window.open('','_blank','width=900,height=600')
    // Agrupar notas por cliente
    const porCliente = {}
    notas.forEach(n=>{
      const k = n.cedrifclie||'SIN CEDULA'
      if (!porCliente[k]) porCliente[k]={nombre:n.nombreclie,cedula:k,notas:[]}
      porCliente[k].notas.push(n)
    })
    w.document.write(`<html><head><title>Detalle Cartera</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;padding:20px;}
      h2{color:#1a3a6b;text-align:center;margin-bottom:4px;}
      .sub{text-align:center;color:#555;margin-bottom:12px;}
      .cliente{background:#1a3a6b;color:#fff;padding:5px 10px;margin-top:14px;font-weight:700;}
      .cli-info{background:#dde3ee;padding:3px 10px;font-size:10px;margin-bottom:4px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#dde3ee;color:#1a3a6b;padding:4px 6px;text-align:left;font-size:10px;font-weight:700;}
      td{padding:3px 6px;border-bottom:1px solid #eee;}
      .tot{font-weight:900;border-top:1px solid #aaa;}
      @media print{body{padding:8px;} .cliente{page-break-before:auto;}}
    </style></head><body>
    <h2>ATM — DETALLE DE CARTERA</h2>
    <div class="sub">Vendedor: ${nomVend} &nbsp;|&nbsp; Fecha: ${hoy()}</div>
    ${Object.values(porCliente).map(cli=>`
      <div class="cliente">${cli.cedula} &nbsp; ${cli.nombre}</div>
      <table>
        <thead><tr>
          <th># Docto</th><th>Fecha</th><th>Vencim.</th>
          <th style="text-align:right">$ Valor</th><th style="text-align:right">$ Dcto</th>
          <th style="text-align:right">$ Abonos</th><th style="text-align:right">$ Saldo</th><th style="text-align:right">Mora</th>
        </tr></thead>
        <tbody>
          ${cli.notas.map(n=>`
            <tr>
              <td>${n.numnotaent}</td>
              <td>${n.fechanotae}</td>
              <td>${n.fechavence||''}</td>
              <td style="text-align:right">$${fmt(n.valtotal)}</td>
              <td style="text-align:right">0</td>
              <td style="text-align:right">$${fmt(n.valabono)}</td>
              <td style="text-align:right;font-weight:700">$${fmt(n.saldo)}</td>
              <td style="text-align:right">${n.diasVencido}</td>
            </tr>`).join('')}
          <tr class="tot">
            <td colspan="6" style="text-align:right">SALDO TOTAL $</td>
            <td style="text-align:right;font-weight:900">$${fmt(cli.notas.reduce((s,n)=>s+(n.saldo||0),0))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>`).join('')}
    <div style="margin-top:20px;font-weight:900;text-align:right;font-size:13px;border-top:2px solid #1a3a6b;padding-top:8px;">
      TOTAL CARTERA: $${fmt(totales.saldo)}
    </div>
    </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},400)
  }

  const TABS = [
    {id:'resumen', label:'📋 Resumen por Cliente'},
    {id:'detalle', label:'🔍 Detalle por Nota'},
  ]

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>CARTERA</span>
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        {/* FILTROS */}
        <div style={P.filtros}>
          {usuario?.rol==='admin' && (
            <label style={P.lbl}>Vendedor
              <select style={P.inp} value={filtVend} onChange={e=>setFiltVend(e.target.value)}>
                <option value="">Todos</option>
                {vendedores.map(v=><option key={v.cedula} value={v.cedula}>{v.nombre}</option>)}
              </select>
            </label>
          )}
          <label style={P.lbl}>Cliente
            <input style={P.inp} value={filtCliente} onChange={e=>setFiltCliente(e.target.value)}
              placeholder="Nombre del cliente…" onKeyDown={e=>e.key==='Enter'&&generar()}/>
          </label>
          <label style={P.lbl}>Estado
            <select style={P.inp} value={filtEstado} onChange={e=>setFiltEstado(e.target.value)}>
              <option value="pendiente">Solo pendientes</option>
              <option value="pagada">Solo pagadas</option>
              <option value="todas">Todas</option>
            </select>
          </label>
          <label style={P.lbl}>Mora mínima
            <select style={P.inp} value={filtMora} onChange={e=>setFiltMora(e.target.value)}>
              <option value="todos">Todas</option>
              <option value="mora30">+30 días</option>
              <option value="mora60">+60 días</option>
              <option value="mora90">+90 días</option>
            </select>
          </label>
          <button onClick={generar} disabled={cargando} style={P.btnGenerar}>
            {cargando?'⏳ Cargando…':'🔍 Generar'}
          </button>
          {generado && (
            <div style={{marginLeft:'auto',display:'flex',gap:8}}>
              <button onClick={imprimirResumen} style={P.btnPrint}>🖨 Resumen</button>
              <button onClick={imprimirDetalle} style={P.btnPrint}>🖨 Detalle</button>
            </div>
          )}
        </div>

        {!generado && !cargando && (
          <div style={{textAlign:'center',padding:60,color:'#aab8d4',fontSize:14}}>
            Selecciona los filtros y presiona <strong>Generar</strong>
          </div>
        )}

        {generado && (
          <>
            {/* TOTALES RÁPIDOS */}
            <div style={P.totalBar}>
              <Tot label="Clientes" val={resumen.length} color="#1a3a6b"/>
              <Tot label="Notas"    val={notas.length}   color="#e65100"/>
              <Tot label="$ Valor"  val={`$${fmt(totales.valor)}`}   color="#555"/>
              <Tot label="$ Abonado" val={`$${fmt(totales.abonado)}`} color="#2e7d32"/>
              <Tot label="$ Saldo"  val={`$${fmt(totales.saldo)}`}   color="#c62828" grande/>
            </div>

            {/* TABS */}
            <div style={P.tabs}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{...P.tab,...(tab===t.id?P.tabActivo:{})}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={P.contenido}>
              {/* RESUMEN */}
              {tab==='resumen' && (
                <table style={P.tabla}>
                  <thead>
                    <tr style={P.thead}>
                      {['Cédula','Cliente','Notas','$ Valor','$ Abonado','$ Saldo','Días mora'].map(h=>(
                        <th key={h} style={{...P.th,textAlign:['Notas','$ Valor','$ Abonado','$ Saldo','Días mora'].includes(h)?'right':'left'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.map((c,i)=>(
                      <tr key={c.cedula} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                        <td style={P.td}>{c.cedula}</td>
                        <td style={{...P.td,fontWeight:600}}>{c.nombre}</td>
                        <td style={{...P.td,textAlign:'right'}}>{c.notas}</td>
                        <td style={{...P.td,textAlign:'right'}}>${fmt(c.valor)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(c.abonado)}</td>
                        <td style={{...P.td,textAlign:'right',fontWeight:700,color:'#c62828'}}>${fmt(c.saldo)}</td>
                        <td style={{...P.td,textAlign:'right',fontWeight:700,color:colorMora(c.maxDias)}}>{c.maxDias}d</td>
                      </tr>
                    ))}
                    <tr style={P.totRow}>
                      <td colSpan={3} style={P.td}><strong>TOTALES — {resumen.length} clientes</strong></td>
                      <td style={{...P.td,textAlign:'right'}}>${fmt(totales.valor)}</td>
                      <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(totales.abonado)}</td>
                      <td style={{...P.td,textAlign:'right',fontSize:15,color:'#c62828'}}>${fmt(totales.saldo)}</td>
                      <td style={P.td}></td>
                    </tr>
                    {resumen.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#888'}}>Sin resultados con esos filtros.</td></tr>}
                  </tbody>
                </table>
              )}

              {/* DETALLE */}
              {tab==='detalle' && (
                <table style={P.tabla}>
                  <thead>
                    <tr style={P.thead}>
                      {['Nota','Fecha','Vencim.','Cédula','Cliente','Vendedor','$ Valor','$ Abonado','$ Saldo','Días nota','Días venc.'].map(h=>(
                        <th key={h} style={{...P.th,textAlign:['$ Valor','$ Abonado','$ Saldo','Días nota','Días venc.'].includes(h)?'right':'left'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {notas.map((n,i)=>(
                      <tr key={n.numnotaent} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                        <td style={{...P.td,fontWeight:700,color:'#1a3a6b'}}>{n.numnotaent}</td>
                        <td style={P.td}>{n.fechanotae}</td>
                        <td style={P.td}>{n.fechavence||'—'}</td>
                        <td style={P.td}>{n.cedrifclie}</td>
                        <td style={{...P.td,fontWeight:600}}>{n.nombreclie}</td>
                        <td style={P.td}>{vendedores.find(v=>v.cedula===n.cedvended)?.nombre||n.cedvended}</td>
                        <td style={{...P.td,textAlign:'right'}}>${fmt(n.valtotal)}</td>
                        <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(n.valabono)}</td>
                        <td style={{...P.td,textAlign:'right',fontWeight:700,color:n.saldo>0?'#c62828':'#2e7d32'}}>${fmt(n.saldo)}</td>
                        <td style={{...P.td,textAlign:'right'}}>{n.diasNota}d</td>
                        <td style={{...P.td,textAlign:'right',fontWeight:700,color:colorMora(n.diasVencido)}}>{n.diasVencido}d</td>
                      </tr>
                    ))}
                    <tr style={P.totRow}>
                      <td colSpan={6} style={P.td}><strong>TOTALES — {notas.length} notas</strong></td>
                      <td style={{...P.td,textAlign:'right'}}>${fmt(totales.valor)}</td>
                      <td style={{...P.td,textAlign:'right',color:'#2e7d32'}}>${fmt(totales.abonado)}</td>
                      <td style={{...P.td,textAlign:'right',fontSize:15,color:'#c62828'}}>${fmt(totales.saldo)}</td>
                      <td colSpan={2} style={P.td}></td>
                    </tr>
                    {notas.length===0&&<tr><td colSpan={11} style={{textAlign:'center',padding:20,color:'#888'}}>Sin resultados.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tot({label,val,color,grande}){
  return(
    <div style={{textAlign:'center',padding:'4px 16px',borderRight:'1px solid #c8d5ea'}}>
      <div style={{fontSize:10,color:'#888',fontWeight:600,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:grande?18:14,fontWeight:700,color}}>{val}</div>
    </div>
  )
}

const P={
  pagina:   {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:  {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden',display:'flex',flexDirection:'column'},
  titulo:   {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt:  {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:   {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  btnCerrar:{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  filtros:  {display:'flex',gap:10,alignItems:'flex-end',padding:'10px 14px',background:'#fff',borderBottom:'1px solid #c8d5ea',flexWrap:'wrap'},
  lbl:      {display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b',flex:1,minWidth:140},
  inp:      {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none'},
  btnGenerar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 20px',cursor:'pointer',fontWeight:700,fontSize:13,height:32,alignSelf:'flex-end'},
  btnPrint: {background:'#2e7d32',color:'#fff',border:'none',borderRadius:5,padding:'0 14px',cursor:'pointer',fontWeight:700,fontSize:12,height:32},
  totalBar: {display:'flex',background:'#fff',borderBottom:'2px solid #c8d5ea',padding:'6px 0'},
  tabs:     {display:'flex',background:'#dde3ee',borderBottom:'2px solid #8fa4c8'},
  tab:      {padding:'8px 20px',cursor:'pointer',fontSize:12,fontWeight:600,color:'#5577aa',border:'none',background:'transparent',borderBottom:'3px solid transparent'},
  tabActivo:{color:'#1a3a6b',fontWeight:800,borderBottom:'3px solid #1a3a6b',background:'#fff'},
  contenido:{overflowY:'auto',flex:1,maxHeight:'calc(100vh - 220px)'},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:    {background:'#1a3a6b',position:'sticky',top:0},
  th:       {padding:'7px 10px',color:'#fff',fontWeight:700,fontSize:11,whiteSpace:'nowrap'},
  td:       {padding:'5px 10px',borderBottom:'1px solid #eee'},
  totRow:   {background:'#dde3ee',fontWeight:900},
}
