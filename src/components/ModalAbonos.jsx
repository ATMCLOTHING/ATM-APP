// src/components/ModalAbonos.jsx
import { useState, useEffect } from 'react'
import ModalPin from './ModalPin'

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const hoy = () => new Date().toISOString().slice(0, 10)

export default function ModalAbonos({ supabase, nroDoc, totalNota, totalAbonos, onClose }) {
  const [abonos,        setAbonos]        = useState([])
  const [fecha,         setFecha]         = useState(hoy())
  const [valor,         setValor]         = useState('')
  const [medio,         setMedio]         = useState('Efectivo')
  const [obs,           setObs]           = useState('')
  const [cargando,      setCargando]      = useState(false)
  const [msg,           setMsg]           = useState(null)
  const [pinAccion,     setPinAccion]     = useState(null) // {tipo:'revertir'|'revertirParcial', abono:{...}, valor?}
  const [valoresRev,    setValoresRev]    = useState({}) // {abonoId: valorParcialADigitar}

  useEffect(() => { cargarAbonos() }, [])

  async function cargarAbonos() {
    const { data } = await supabase
      .from('detabonos').select('*').eq('numnotaent', nroDoc)
      .order('fechaabono', { ascending: true })
    setAbonos(data || [])
  }

  const sumaAbonos = abonos.reduce((s, a) => s + (a.valabono || 0), 0)
  const saldoFinal = totalNota - sumaAbonos

  async function registrarAbono() {
    const val = Number(valor)
    if (!val || val <= 0) { setMsg({ tipo: 'err', texto: 'Ingresa un valor válido.' }); return }
    if (val > saldoFinal + 0.01) { setMsg({ tipo: 'err', texto: `El abono ($${fmt(val)}) supera el saldo ($${fmt(saldoFinal)}).` }); return }
    setCargando(true)
    const { error } = await supabase.from('detabonos').insert({
      numnotaent: nroDoc, fechaabono: fecha, valabono: val, mediopago: medio, observacio: obs,
    })
    if (error) {
      setMsg({ tipo: 'err', texto: error.message })
    } else {
      const nuevoAbono = sumaAbonos + val
      const nuevoSaldo = totalNota - nuevoAbono
      await supabase.from('encnotaen').update({ valabono: nuevoAbono, saldo: nuevoSaldo }).eq('numnotaent', nroDoc)
      setMsg({ tipo: 'ok', texto: `✅ Abono de $${fmt(val)} registrado.` })
      setValor(''); setObs('')
      cargarAbonos()
    }
    setCargando(false)
  }

  // Pide PIN antes de revertir el abono completo
  function pedirRevertir(abono) {
    setPinAccion({ tipo: 'revertir', abono })
  }

  // Pide PIN antes de revertir solo una parte del abono
  function pedirRevertirParcial(abono) {
    const valor = Number(valoresRev[abono.id] || 0)
    if (!valor || valor <= 0) { setMsg({ tipo:'err', texto:'Ingresa el valor a revertir.' }); return }
    if (valor >= abono.valabono) { pedirRevertir(abono); return } // si es el total o más, se trata como total
    setPinAccion({ tipo: 'revertirParcial', abono, valor })
  }

  // Ejecuta la reversión total después de confirmar PIN
  async function ejecutarReversion(abono) {
    setPinAccion(null)
    const nuevaSum = sumaAbonos - abono.valabono
    const nuevoSaldo = totalNota - nuevaSum
    const { error } = await supabase.from('detabonos').delete().eq('id', abono.id)
    if (error) { setMsg({ tipo: 'err', texto: `❌ ${error.message}` }); return }
    await supabase.from('encnotaen').update({ valabono: nuevaSum, saldo: nuevoSaldo }).eq('numnotaent', nroDoc)
    setMsg({ tipo: 'ok', texto: `✅ Abono de $${fmt(abono.valabono)} revertido en su totalidad.` })
    cargarAbonos()
  }

  // Ejecuta la reversión parcial después de confirmar PIN
  async function ejecutarReversionParcial(abono, valor) {
    setPinAccion(null)
    const nuevoValAbono = abono.valabono - valor
    const nuevaSum = sumaAbonos - valor
    const nuevoSaldo = totalNota - nuevaSum
    const { error } = await supabase.from('detabonos').update({ valabono: nuevoValAbono }).eq('id', abono.id)
    if (error) { setMsg({ tipo: 'err', texto: `❌ ${error.message}` }); return }
    await supabase.from('encnotaen').update({ valabono: nuevaSum, saldo: nuevoSaldo }).eq('numnotaent', nroDoc)
    setMsg({ tipo: 'ok', texto: `✅ Se revirtieron $${fmt(valor)} del abono. Queda con $${fmt(nuevoValAbono)}.` })
    setValoresRev(prev => ({ ...prev, [abono.id]: '' }))
    cargarAbonos()
  }

  return (
    <div style={S.fondo}>
      {pinAccion && pinAccion.tipo === 'revertir' && (
        <ModalPin
          supabase={supabase}
          titulo="Revertir Abono Total"
          descripcion={`¿Revertir el abono de $${fmt(pinAccion.abono.valabono)} del ${pinAccion.abono.fechaabono}? Esta acción requiere autorización.`}
          onConfirm={() => ejecutarReversion(pinAccion.abono)}
          onClose={() => setPinAccion(null)}
        />
      )}
      {pinAccion && pinAccion.tipo === 'revertirParcial' && (
        <ModalPin
          supabase={supabase}
          titulo="Revertir Abono Parcial"
          descripcion={`¿Revertir $${fmt(pinAccion.valor)} del abono de $${fmt(pinAccion.abono.valabono)} del ${pinAccion.abono.fechaabono}? Esta acción requiere autorización.`}
          onConfirm={() => ejecutarReversionParcial(pinAccion.abono, pinAccion.valor)}
          onClose={() => setPinAccion(null)}
        />
      )}

      <div style={S.modal}>
        <div style={S.cabecera}>
          <span>💵 ABONOS — Nota {nroDoc}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {/* resumen */}
        <div style={S.resumen}>
          <Dato label="Total nota"   valor={fmt(totalNota)}  />
          <Dato label="Total abonos" valor={fmt(sumaAbonos)} color="#27ae60" />
          <Dato label="Saldo"        valor={fmt(saldoFinal)} color={saldoFinal > 0 ? '#c0392b' : '#27ae60'} />
        </div>

        {msg && (
          <div style={{color:msg.tipo==='ok'?'#155724':'#721c24',background:msg.tipo==='ok'?'#d4edda':'#f8d7da',padding:'6px 10px',borderRadius:4,fontSize:12,marginBottom:10,display:'flex',justifyContent:'space-between'}}>
            {msg.texto}
            <button onClick={()=>setMsg(null)} style={{background:'none',border:'none',cursor:'pointer',fontWeight:700}}>✕</button>
          </div>
        )}

        {/* historial */}
        {abonos.length > 0 && (
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                {['Fecha','Valor','Medio','Observación','Revertir parcial',''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {abonos.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f5f7fc' }}>
                  <td style={S.td}>{a.fechaabono}</td>
                  <td style={{ ...S.td, textAlign:'right', fontWeight:600, color:'#27ae60' }}>${fmt(a.valabono)}</td>
                  <td style={S.td}>{a.mediopago}</td>
                  <td style={S.td}>{a.observacio}</td>
                  <td style={{...S.td,textAlign:'center'}}>
                    <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                      <input type="number" placeholder="Valor" min={0} max={a.valabono}
                        style={S.inpRev}
                        value={valoresRev[a.id]||''}
                        onChange={e=>setValoresRev(prev=>({...prev,[a.id]:e.target.value}))}/>
                      <button onClick={()=>pedirRevertirParcial(a)} title="Revertir solo una parte" style={S.btnRevertirParcial}>↩ Parcial</button>
                    </div>
                  </td>
                  <td style={{...S.td,textAlign:'center'}}>
                    <button
                      onClick={() => pedirRevertir(a)}
                      title="Revertir este abono por completo"
                      style={S.btnRevertir}>
                      ↩ Total
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {abonos.length === 0 && <p style={S.sinAbonos}>Sin abonos registrados.</p>}

        {/* formulario nuevo abono */}
        {saldoFinal > 0 && (
          <div style={S.formAbono}>
            <strong style={{ color: '#1a3a6b', fontSize: 13 }}>Registrar nuevo abono</strong>
            <div style={S.filaForm}>
              <label style={S.lbl}>Fecha
                <input type="date" style={S.inp} value={fecha} onChange={e => setFecha(e.target.value)} />
              </label>
              <label style={S.lbl}>Valor ($)
                <input type="number" style={S.inp} value={valor} min={0} max={saldoFinal}
                  onChange={e => setValor(e.target.value)} placeholder="0" />
              </label>
              <label style={S.lbl}>Medio de pago
                <select style={S.inp} value={medio} onChange={e => setMedio(e.target.value)}>
                  {['Efectivo','Transferencia','Mixto'].map(m => <option key={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <label style={S.lbl}>Observación
              <input style={S.inp} value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional…" />
            </label>
            <button onClick={registrarAbono} disabled={cargando} style={S.btnGuardar}>
              {cargando ? 'Guardando…' : '💾 Registrar abono'}
            </button>
          </div>
        )}
        {saldoFinal <= 0 && (
          <div style={{ textAlign:'center', color:'#27ae60', fontWeight:700, padding:12 }}>
            ✅ Nota pagada completamente
          </div>
        )}
      </div>
    </div>
  )
}

function Dato({ label, valor, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:800, color: color || '#1a3a6b' }}>${valor}</div>
    </div>
  )
}

const S = {
  fondo:      { position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200 },
  modal:      { background:'#fff',borderRadius:8,padding:20,width:700,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.3)' },
  cabecera:   { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,fontSize:15,fontWeight:800,color:'#1a3a6b' },
  btnX:       { background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700 },
  resumen:    { display:'flex',justifyContent:'space-around',background:'#f0f4ff',borderRadius:6,padding:'10px 0',marginBottom:14,border:'1px solid #c8d5ea' },
  tabla:      { width:'100%',borderCollapse:'collapse',fontSize:12,marginBottom:14 },
  thead:      { background:'#dde3ee' },
  th:         { padding:'5px 8px',fontWeight:700,color:'#1a3a6b',borderBottom:'2px solid #aab8d4',textAlign:'left' },
  td:         { padding:'5px 8px',borderBottom:'1px solid #eee',fontSize:12 },
  btnRevertir:{ background:'#fff3cd',border:'1px solid #ffc107',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:11,fontWeight:700,color:'#856404',whiteSpace:'nowrap' },
  btnRevertirParcial:{ background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:4,padding:'3px 8px',cursor:'pointer',fontSize:11,fontWeight:700,color:'#1565c0',whiteSpace:'nowrap' },
  inpRev:     { width:70,height:24,border:'1px solid #aab8d4',borderRadius:3,padding:'0 4px',fontSize:11,outline:'none' },
  sinAbonos:  { textAlign:'center',color:'#888',padding:'12px 0',fontSize:12 },
  formAbono:  { display:'flex',flexDirection:'column',gap:10,background:'#f8f9ff',borderRadius:6,padding:14,border:'1px solid #c8d5ea',marginTop:10 },
  filaForm:   { display:'flex',gap:10,flexWrap:'wrap' },
  lbl:        { display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b',flex:1 },
  inp:        { height:26,border:'1px solid #aab8d4',borderRadius:3,padding:'0 6px',fontSize:12,outline:'none',marginTop:2 },
  btnGuardar: { background:'#2980b9',color:'#fff',border:'none',borderRadius:4,padding:'8px 16px',cursor:'pointer',fontWeight:700,fontSize:13,alignSelf:'flex-end' },
}
