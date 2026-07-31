// src/components/LogErrores.jsx
// Pantalla de auditoría: registro de errores en operaciones de guardado (para no
// perder rastro cuando algo falla) + un chequeo bajo pedido que busca "huecos
// peligrosos" (movimientos de Kardex/abonos/vales que quedaron apuntando a una
// nota que nunca se guardó, como pasó con las notas 50435 y 50952).
import { useState, useEffect } from 'react'

const fmtFec = f => f ? new Date(f).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''

export default function LogErrores({ supabase, onClose }) {
  const [errores,    setErrores]    = useState([])
  const [cargando,   setCargando]   = useState(false)
  const [soloPend,   setSoloPend]   = useState(true)
  const [huerfanos,  setHuerfanos]  = useState(null) // null = no se ha corrido el chequeo
  const [verificando,setVerificando]= useState(false)
  const [msg,        setMsg]        = useState(null)

  useEffect(() => { cargarErrores() }, [soloPend])

  async function cargarErrores() {
    setCargando(true)
    let q = supabase.from('log_errores').select('*').order('fecha', {ascending:false}).limit(300)
    if (soloPend) q = q.eq('revisado', false)
    const {data, error} = await q
    if (error) setMsg({tipo:'err', texto:`❌ ${error.message}`})
    setErrores(data||[])
    setCargando(false)
  }

  async function marcarRevisado(id) {
    await supabase.from('log_errores').update({revisado:true}).eq('id', id)
    setErrores(prev => soloPend ? prev.filter(e=>e.id!==id) : prev.map(e=>e.id===id?{...e,revisado:true}:e))
  }

  async function verificarHuerfanos() {
    setVerificando(true); setMsg(null)
    const {data, error} = await supabase.rpc('verificar_notas_huerfanas')
    if (error) { setMsg({tipo:'err', texto:`❌ No se pudo verificar: ${error.message}`}) }
    else setHuerfanos(data||[])
    setVerificando(false)
  }

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>
        <div style={P.titulo}>
          <span style={P.titTxt}>🔍 LOG DE ERRORES Y CONSISTENCIA</span>
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        {msg && (
          <div style={{...P.alerta, background:msg.tipo==='ok'?'#e8f5e9':'#ffebee', color:msg.tipo==='ok'?'#2e7d32':'#c62828'}}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        {/* VERIFICACIÓN DE HUECOS PELIGROSOS */}
        <div style={P.seccion}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <div>
              <div style={P.secTit}>Verificar huecos peligrosos</div>
              <div style={{fontSize:12,color:'#666'}}>
                Busca movimientos de Kardex, abonos o vales que quedaron apuntando a una nota que nunca se guardó
                (así aparecieron las notas 50435 y 50952). No revisa números de nota simplemente sin usar — esos son normales.
              </div>
            </div>
            <button onClick={verificarHuerfanos} disabled={verificando} style={P.btnAccion}>
              {verificando ? '⏳ Verificando…' : '🔎 Verificar ahora'}
            </button>
          </div>

          {huerfanos !== null && (
            huerfanos.length === 0 ? (
              <div style={{marginTop:12,padding:10,background:'#e8f5e9',color:'#2e7d32',borderRadius:6,fontSize:13,fontWeight:700}}>
                ✅ No se encontró ningún hueco peligroso. Todo lo registrado en Kardex, abonos y vales corresponde a notas que sí existen.
              </div>
            ) : (
              <table style={{...P.tabla, marginTop:12}}>
                <thead>
                  <tr style={P.thead}>
                    {['Origen','# Nota (no existe)','Registros','Primero','Último'].map(h=><th key={h} style={P.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {huerfanos.map((h,i)=>(
                    <tr key={`${h.origen}-${h.numnotaent}`} style={{background:i%2===0?'#fff':'#fff5f5'}}>
                      <td style={P.td}>{h.origen}</td>
                      <td style={{...P.td,fontWeight:700,color:'#c62828'}}>{h.numnotaent}</td>
                      <td style={P.td}>{h.cantidad}</td>
                      <td style={P.td}>{fmtFec(h.primer_registro)}</td>
                      <td style={P.td}>{fmtFec(h.ultimo_registro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* LOG DE ERRORES */}
        <div style={P.seccion}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={P.secTit}>Errores registrados</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                <input type="checkbox" checked={soloPend} onChange={e=>setSoloPend(e.target.checked)}/> Solo pendientes
              </label>
              <button onClick={cargarErrores} style={P.btnRecargar} title="Recargar">🔄</button>
            </div>
          </div>

          {cargando ? (
            <div style={{textAlign:'center',padding:24,color:'#888'}}>Cargando…</div>
          ) : errores.length === 0 ? (
            <div style={{textAlign:'center',padding:24,color:'#888'}}>
              {soloPend ? 'No hay errores pendientes de revisar. 🎉' : 'No hay errores registrados.'}
            </div>
          ) : (
            <table style={P.tabla}>
              <thead>
                <tr style={P.thead}>
                  {['Fecha','Módulo','Acción','# Nota','Usuario','Mensaje',''].map(h=><th key={h} style={P.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {errores.map((e,i)=>(
                  <tr key={e.id} style={{background:i%2===0?'#fff':'#f8faff'}}>
                    <td style={P.td}>{fmtFec(e.fecha)}</td>
                    <td style={P.td}>{e.modulo}</td>
                    <td style={P.td}>{e.accion}</td>
                    <td style={{...P.td,fontWeight:700}}>{e.numnotaent||''}</td>
                    <td style={P.td}>{e.usuario||''}</td>
                    <td style={{...P.td,maxWidth:340,whiteSpace:'normal'}}>{e.mensaje}</td>
                    <td style={P.td}>
                      {!e.revisado && (
                        <button onClick={()=>marcarRevisado(e.id)} style={P.btnRevisado}>✓ Marcar revisado</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const P = {
  pagina:      {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:     {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1200,margin:'0 auto',overflow:'hidden',display:'flex',flexDirection:'column'},
  titulo:      {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'},
  titTxt:      {fontWeight:900,fontSize:15,letterSpacing:1},
  btnCerrar:   {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  alerta:      {margin:'10px 16px 0',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:     {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:18},
  seccion:     {background:'#fff',borderRadius:10,padding:16,margin:'14px 16px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'},
  secTit:      {fontSize:13,fontWeight:800,color:'#1a3a6b',marginBottom:4},
  btnAccion:   {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',cursor:'pointer',fontWeight:700,fontSize:13,whiteSpace:'nowrap'},
  btnRecargar: {height:28,padding:'0 10px',border:'1px solid #c8d5ea',borderRadius:5,background:'#fff',cursor:'pointer',fontSize:15},
  btnRevisado: {background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:11,fontWeight:700,whiteSpace:'nowrap'},
  tabla:       {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:       {background:'#1a3a6b'},
  th:          {padding:'7px 9px',textAlign:'left',fontWeight:700,color:'#fff',whiteSpace:'nowrap'},
  td:          {padding:'6px 9px',borderBottom:'1px solid #e8eef5',verticalAlign:'top',whiteSpace:'nowrap'},
}
