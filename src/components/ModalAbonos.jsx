// src/components/ModalAbonos.jsx
// Modal para registrar y ver los abonos de una nota de entrega.

import { useState, useEffect } from 'react'

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const hoy = () => new Date().toISOString().slice(0, 10)

export default function ModalAbonos({ supabase, nroDoc, totalNota, totalAbonos, guardada, onClose }) {
  const [abonos,    setAbonos]    = useState([])
  const [fecha,     setFecha]     = useState(hoy())
  const [valor,     setValor]     = useState('')
  const [medio,     setMedio]     = useState('Efectivo')
  const [obs,       setObs]       = useState('')
  const [cargando,  setCargando]  = useState(false)
  const [msg,       setMsg]       = useState(null)

  const saldoActual = totalNota - totalAbonos

  useEffect(() => { cargarAbonos() }, [])

  async function cargarAbonos() {
    const { data } = await supabase
      .from('detabonos')
      .select('*')
      .eq('numnotaent', nroDoc)
      .order('fechaabono', { ascending: true })
    setAbonos(data || [])
  }

  async function registrarAbono() {
    if (!guardada) {
      setMsg({ tipo: 'err', texto: 'Debes guardar la nota antes de registrar un abono.' })
      return
    }
    const val = Number(valor)
    if (!val || val <= 0) { setMsg({ tipo: 'err', texto: 'Ingresa un valor válido.' }); return }
    if (val > saldoActual + 0.01) { setMsg({ tipo: 'err', texto: `El abono ($${fmt(val)}) supera el saldo ($${fmt(saldoActual)}).` }); return }

    setCargando(true)
    const { error } = await supabase.from('detabonos').insert({
      numnotaent: nroDoc,
      fechaabono: fecha,
      valabono:   val,
      mediopago:  medio,
      observacio: obs,
    })
    if (error) {
      setMsg({ tipo: 'err', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: `Abono de $${fmt(val)} registrado.` })
      setValor(''); setObs('')
      // actualizar saldo en encnotaen
      const nuevoAbono  = totalAbonos + val
      const nuevoSaldo  = totalNota - nuevoAbono
      await supabase.from('encnotaen').update({
        valabono: nuevoAbono,
        saldo:    nuevoSaldo,
      }).eq('numnotaent', nroDoc)
      cargarAbonos()
    }
    setCargando(false)
  }

  async function eliminarAbono(id, valAbono) {
    if (!window.confirm('¿Eliminar este abono?')) return
    await supabase.from('detabonos').delete().eq('id', id)
    const nuevoAbono = totalAbonos - valAbono
    const nuevoSaldo = totalNota - nuevoAbono
    await supabase.from('encnotaen').update({ valabono: nuevoAbono, saldo: nuevoSaldo }).eq('numnotaent', nroDoc)
    cargarAbonos()
  }

  const sumaAbonos = abonos.reduce((s, a) => s + (a.valabono || 0), 0)
  const saldoFinal = totalNota - sumaAbonos

  return (
    <div style={S.fondo}>
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

        {/* historial */}
        {abonos.length > 0 && (
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                {['Fecha','Valor','Medio','Observación',''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {abonos.map((a, i) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f5f7fc' }}>
                  <td style={S.td}>{a.fechaabono}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>${fmt(a.valabono)}</td>
                  <td style={S.td}>{a.mediopago}</td>
                  <td style={S.td}>{a.observacio}</td>
                  <td style={S.td}>
                    <button onClick={() => eliminarAbono(a.id, a.valabono)} style={S.btnDel}>🗑</button>
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
            {msg && (
              <div style={{ color: msg.tipo === 'ok' ? '#155724' : '#721c24', background: msg.tipo === 'ok' ? '#d4edda' : '#f8d7da', padding: '4px 10px', borderRadius: 4, fontSize: 12 }}>
                {msg.texto}
              </div>
            )}
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
          <div style={{ textAlign: 'center', color: '#27ae60', fontWeight: 700, padding: 12 }}>
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
      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || '#1a3a6b' }}>${valor}</div>
    </div>
  )
}

const S = {
  fondo:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:   { background: '#fff', borderRadius: 8, padding: 20, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
  cabecera:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 15, fontWeight: 800, color: '#1a3a6b' },
  btnX:    { background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 },
  resumen: { display: 'flex', justifyContent: 'space-around', background: '#f0f4ff', borderRadius: 6, padding: '10px 0', marginBottom: 14, border: '1px solid #c8d5ea' },
  tabla:   { width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 },
  thead:   { background: '#dde3ee' },
  th:      { padding: '5px 8px', fontWeight: 700, color: '#1a3a6b', borderBottom: '2px solid #aab8d4', textAlign: 'left' },
  td:      { padding: '5px 8px', borderBottom: '1px solid #eee', fontSize: 12 },
  btnDel:  { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#c0392b' },
  sinAbonos: { textAlign: 'center', color: '#888', padding: '12px 0', fontSize: 12 },
  formAbono: { display: 'flex', flexDirection: 'column', gap: 10, background: '#f8f9ff', borderRadius: 6, padding: 14, border: '1px solid #c8d5ea', marginTop: 10 },
  filaForm:  { display: 'flex', gap: 10, flexWrap: 'wrap' },
  lbl:    { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 700, color: '#1a3a6b', flex: 1 },
  inp:    { height: 26, border: '1px solid #aab8d4', borderRadius: 3, padding: '0 6px', fontSize: 12, outline: 'none', marginTop: 2 },
  btnGuardar: { background: '#2980b9', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, alignSelf: 'flex-end' },
}
