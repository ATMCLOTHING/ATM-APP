// src/components/Vales.jsx
// Consulta de vales emitidos por devoluciones: buscar, ver historial,
// reimprimir comprobante y anular (con PIN).

import { useState, useEffect } from 'react'
import { LOGO } from '../lib/assets'
import ModalPin from './ModalPin'
import { fmtFecha } from '../lib/fecha'

const fmt  = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})
const fmtM = n => '$' + fmt(n)
const hoy  = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }

const ESTADO_STYLE = {
  ACTIVO:   {bg:'#e8f5e9', color:'#2e7d32', label:'ACTIVO'},
  AGOTADO:  {bg:'#eceff1', color:'#546e7a', label:'AGOTADO'},
  ANULADO:  {bg:'#fdecea', color:'#c62828', label:'ANULADO'},
}

export default function Vales({ supabase, usuario, onClose, onAyuda }) {
  const [codigo,    setCodigo]    = useState('')
  const [cliente,   setCliente]   = useState('')
  const [estado,    setEstado]    = useState('todos')
  const [vales,     setVales]     = useState([])
  const [buscando,  setBuscando]  = useState(false)
  const [buscado,   setBuscado]   = useState(false)
  const [seleccion, setSeleccion] = useState(null)
  const [movimientos,setMovimientos] = useState([])
  const [pinAccion,  setPinAccion]  = useState(null) // {tipo:'anular', vale}
  const [msg,        setMsg]        = useState(null)

  useEffect(() => { buscar() }, [])

  async function buscar() {
    setBuscando(true); setBuscado(false); setSeleccion(null); setMovimientos([])
    let q = supabase.from('vales').select('*').order('fecregistr',{ascending:false}).limit(300)
    if (codigo.trim())  q = q.ilike('codigo', `%${codigo.trim()}%`)
    if (cliente.trim()) q = q.ilike('cliente_nombre', `%${cliente.trim()}%`)
    if (estado !== 'todos') q = q.eq('estado', estado.toUpperCase())
    const {data, error} = await q
    if (error) { setMsg({tipo:'err',texto:error.message}); setVales([]) }
    else setVales(data||[])
    setBuscado(true); setBuscando(false)
  }

  async function seleccionar(v) {
    setSeleccion(v)
    const {data} = await supabase.from('vale_movimientos').select('*').eq('vale_id', v.id).order('fecregistr',{ascending:true})
    setMovimientos(data||[])
  }

  function pedirAnular(v) {
    if (v.estado === 'ANULADO') return
    setPinAccion({tipo:'anular', vale:v})
  }

  async function ejecutarAnular(v) {
    setPinAccion(null)
    const {error} = await supabase.from('vales').update({estado:'ANULADO'}).eq('id', v.id)
    if (error) { setMsg({tipo:'err',texto:error.message}); return }
    await supabase.from('vale_movimientos').insert({
      vale_id:v.id, tipo:'ANULACION', valor:v.saldo,
      usuario: usuario?.usuario || usuario?.nombre || 'sistema',
    })
    setMsg({tipo:'ok', texto:`Vale ${v.codigo} anulado.`})
    await buscar()
  }

  function reimprimir(v) {
    const w = window.open('','_blank','width=320,height=500')
    w.document.write(`
      <html><head><title>Vale ${v.codigo}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New', monospace; font-size:11px; width:280px; padding:8px; }
        .centro { text-align:center; }
        .bold { font-weight:bold; }
        .grande { font-size:14px; }
        .sep { border-top:1px dashed #000; margin:5px 0; }
        .fila { display:flex; justify-content:space-between; }
        .vale-codigo { font-size:20px; font-weight:bold; letter-spacing:2px; text-align:center; margin:4px 0; }
        .vale-valor { font-size:15px; font-weight:bold; text-align:center; }
        @page { size: 80mm auto; margin: 0; }
        @media print { body { width:72mm; margin:0 auto; } }
      </style></head><body>
      <div class="centro bold grande">A TU MEDIDA</div>
      <div class="centro">REIMPRESIÓN DE VALE</div>
      <div class="sep"></div>
      <div class="fila"><span>Cliente:</span><span>${(v.cliente_nombre||'').substring(0,20)}</span></div>
      <div class="fila"><span>Emitido:</span><span>${fmtFecha(v.fecregistr)}</span></div>
      <div class="fila"><span>Nota origen:</span><span>${v.numnotaent_origen||''}</span></div>
      <div class="sep"></div>
      <div class="centro bold">🎫 CÓDIGO</div>
      <div class="vale-codigo">${v.codigo}</div>
      <div class="vale-valor">Saldo disponible: $${fmt(v.saldo)}</div>
      <div class="centro" style="font-size:9px;margin-top:4px;">Válido como parte de pago en<br/>cualquier Nota de Entrega futura.</div>
      <div class="sep"></div>
      <div class="centro" style="font-size:9px;">REIMPRESIÓN — ${hoy()}</div>
      <div style="height:6mm;"></div>
      </body></html>`)
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},300)
  }

  return (
    <div style={P.pagina}>
      {pinAccion && (
        <ModalPin
          supabase={supabase}
          titulo="Anular Vale"
          descripcion={`¿Anular el vale ${pinAccion.vale.codigo} (saldo $${fmt(pinAccion.vale.saldo)})? Esta acción requiere autorización y no se puede revertir.`}
          onConfirm={()=>ejecutarAnular(pinAccion.vale)}
          onClose={()=>setPinAccion(null)}
        />
      )}

      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}><span style={{fontSize:20}}>🎫</span> CONSULTAR VALES</span>
          {onAyuda && <button onClick={onAyuda} title="Ayuda" style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:'50%',width:36,height:36,cursor:'pointer',fontSize:18}}>❓</button>}
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        {msg && (
          <div style={{...P.alerta,background:msg.tipo==='ok'?'#e8f5e9':'#ffebee',color:msg.tipo==='ok'?'#2e7d32':'#c62828',border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        <div style={P.filtros}>
          <Campo label="Código" w={160}>
            <input style={P.inp} value={codigo} onChange={e=>setCodigo(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&buscar()} placeholder="Ej: V-000012"/>
          </Campo>
          <Campo label="Cliente" w={220}>
            <input style={P.inp} value={cliente} onChange={e=>setCliente(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&buscar()} placeholder="Nombre del cliente"/>
          </Campo>
          <Campo label="Estado" w={150}>
            <select style={P.inp} value={estado} onChange={e=>setEstado(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="activo">Con saldo (Activo)</option>
              <option value="agotado">Agotado</option>
              <option value="anulado">Anulado</option>
            </select>
          </Campo>
          <button onClick={buscar} disabled={buscando} style={P.btnBuscar}>
            {buscando ? <><span style={{fontSize:17}}>⏳</span> Buscando…</> : <><span style={{fontSize:17}}>🔍</span> Buscar</>}
          </button>
        </div>

        <div style={P.cuerpo}>
          <div style={P.listaWrap}>
            {buscado && vales.length===0 && <div style={P.hint}>No se encontraron vales con esos criterios.</div>}
            {vales.length>0 && (
              <table style={P.tabla}>
                <thead>
                  <tr style={P.thead}>
                    {['Código','Cliente','Emitido','Valor original','Saldo','Estado'].map(h=>(
                      <th key={h} style={{...P.th,textAlign:['Valor original','Saldo'].includes(h)?'right':h==='Cliente'?'left':'center'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vales.map((v,i)=>{
                    const est = ESTADO_STYLE[v.estado]||ESTADO_STYLE.ACTIVO
                    const sel = seleccion?.id===v.id
                    return (
                      <tr key={v.id} onClick={()=>seleccionar(v)}
                        style={{cursor:'pointer',background:sel?'#e3f2fd':i%2===0?'#fff':'#f8faff'}}>
                        <td style={{...P.td,fontWeight:700,color:'#1a3a6b',textAlign:'center'}}>{v.codigo}</td>
                        <td style={P.td}>{v.cliente_nombre}</td>
                        <td style={{...P.td,textAlign:'center'}}>{fmtFecha(v.fecregistr)}</td>
                        <td style={{...P.td,textAlign:'right'}}>{fmtM(v.valor_original)}</td>
                        <td style={{...P.td,textAlign:'right',fontWeight:700,color:v.saldo>0?'#2e7d32':'#888'}}>{fmtM(v.saldo)}</td>
                        <td style={{...P.td,textAlign:'center'}}>
                          <span style={{background:est.bg,color:est.color,padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:700}}>{est.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {seleccion && (
            <div style={P.panel}>
              <div style={P.panelTit}>Vale {seleccion.codigo}</div>
              <div style={P.panelDato}><span>Cliente</span><strong>{seleccion.cliente_nombre}</strong></div>
              <div style={P.panelDato}><span>Cédula</span><strong>{seleccion.cliente_ced||'—'}</strong></div>
              <div style={P.panelDato}><span>Motivo</span><strong>{seleccion.motivo||'—'}</strong></div>
              <div style={P.panelDato}><span>Nota origen</span><strong>{seleccion.numnotaent_origen||'—'}</strong></div>
              <div style={P.panelDato}><span>Valor original</span><strong>{fmtM(seleccion.valor_original)}</strong></div>
              <div style={P.panelDato}><span>Saldo disponible</span><strong style={{color:'#2e7d32'}}>{fmtM(seleccion.saldo)}</strong></div>

              <div style={{fontSize:12,fontWeight:800,color:'#1a3a6b',margin:'12px 0 6px'}}>Historial de movimientos</div>
              {movimientos.length===0 && <div style={{fontSize:12,color:'#888'}}>Sin movimientos.</div>}
              {movimientos.map(m=>(
                <div key={m.id} style={P.movFila}>
                  <span style={{fontWeight:700,color:m.tipo==='EMISION'?'#2e7d32':m.tipo==='CONSUMO'?'#1565c0':'#c62828'}}>{m.tipo}</span>
                  <span>{fmtFecha(m.fecregistr)}</span>
                  <span>{m.numnotaent?`Nota ${m.numnotaent}`:''}</span>
                  <span style={{fontWeight:700}}>${fmt(m.valor)}</span>
                </div>
              ))}

              <div style={{display:'flex',gap:8,marginTop:14}}>
                <button onClick={()=>reimprimir(seleccion)} style={P.btnAccion}><span style={{fontSize:16}}>🖨</span> Reimprimir</button>
                {seleccion.estado!=='ANULADO' && (
                  <button onClick={()=>pedirAnular(seleccion)} style={{...P.btnAccion,background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a'}}><span style={{fontSize:16}}>🚫</span> Anular</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0,gap:3}}>
      <span style={{fontSize:10,fontWeight:700,color:'#5577aa',textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}

const P = {
  pagina:   {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:  {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden'},
  titulo:   {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt:  {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:   {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  btnCerrar:{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  alerta:   {margin:'8px 10px 0',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:  {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:18},
  filtros:  {display:'flex',gap:10,alignItems:'flex-end',padding:'12px 14px',background:'#fff',borderBottom:'1px solid #c8d5ea',flexWrap:'wrap'},
  inp:      {height:30,border:'1px solid #c8d5ea',borderRadius:5,padding:'0 8px',fontSize:13,color:'#1a3a6b',outline:'none',width:'100%'},
  btnBuscar:{height:30,background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 18px',cursor:'pointer',fontSize:13,fontWeight:700},
  cuerpo:   {display:'flex',gap:14,padding:'12px 14px',alignItems:'flex-start'},
  listaWrap:{flex:1,maxHeight:'70vh',overflowY:'auto',border:'1px solid #e0e7f0',borderRadius:6,background:'#fff'},
  hint:     {textAlign:'center',padding:40,color:'#aaa',fontSize:13},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:13},
  thead:    {background:'#1a3a6b',position:'sticky',top:0},
  th:       {padding:'7px 10px',color:'#fff',fontWeight:700,fontSize:11,whiteSpace:'nowrap'},
  td:       {padding:'6px 10px',borderBottom:'1px solid #eee'},
  panel:    {width:320,flexShrink:0,background:'#fff',border:'1px solid #e0e7f0',borderRadius:6,padding:14},
  panelTit: {fontSize:14,fontWeight:800,color:'#1a3a6b',marginBottom:10,paddingBottom:6,borderBottom:'2px solid #eef0f5'},
  panelDato:{display:'flex',justifyContent:'space-between',fontSize:12,color:'#555',padding:'4px 0',borderBottom:'1px solid #f5f5f5'},
  movFila:  {display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6,fontSize:11,padding:'4px 0',borderBottom:'1px solid #f5f5f5'},
  btnAccion:{flex:1,background:'#eef2ff',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 10px',cursor:'pointer',fontWeight:700,fontSize:12,color:'#1a3a6b'},
}
