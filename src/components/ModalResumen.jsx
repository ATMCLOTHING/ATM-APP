// src/components/ModalResumen.jsx
// Resumen de ventas: listado de notas con filtros por fecha y vendedor.

import { useState, useEffect } from 'react'

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const hoy    = () => new Date().toISOString().slice(0, 10)
const unMesAtras = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export default function ModalResumen({ supabase, onClose, onSelect }) {
  const [desde,    setDesde]   = useState(unMesAtras())
  const [hasta,    setHasta]   = useState(hoy())
  const [notas,    setNotas]   = useState([])
  const [cargando, setCargando]= useState(false)

  useEffect(() => { buscar() }, [])

  async function buscar() {
    setCargando(true)
    const { data } = await supabase
      .from('encnotaen')
      .select('numnotaent,fechanotae,nombreclie,valtotal,valabono,saldo,cedvended,anulada,cantotal,formapago')
      .gte('fechanotae', desde)
      .lte('fechanotae', hasta)
      .eq('anulada', 'N')
      .order('fechanotae', { ascending: false })
    setNotas(data || [])
    setCargando(false)
  }

  const totalVentas = notas.reduce((s, n) => s + (n.valtotal || 0), 0)
  const totalAbonado= notas.reduce((s, n) => s + (n.valabono || 0), 0)
  const totalSaldo  = notas.reduce((s, n) => s + (n.saldo    || 0), 0)
  const totalPrendas= notas.reduce((s, n) => s + (n.cantotal || 0), 0)

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span>📊 RESUMEN DE VENTAS</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {/* filtros */}
        <div style={S.filtros}>
          <label style={S.lbl}>Desde
            <input type="date" style={S.inp} value={desde} onChange={e => setDesde(e.target.value)} />
          </label>
          <label style={S.lbl}>Hasta
            <input type="date" style={S.inp} value={hasta} onChange={e => setHasta(e.target.value)} />
          </label>
          <button onClick={buscar} style={S.btnBuscar} disabled={cargando}>
            {cargando ? '⏳ Buscando…' : '🔍 Buscar'}
          </button>
        </div>

        {/* totales */}
        <div style={S.bandaTotales}>
          <Resumen label="Notas"    val={notas.length}          sinFormato />
          <Resumen label="Prendas"  val={totalPrendas}          sinFormato />
          <Resumen label="Ventas"   val={`$${fmt(totalVentas)}`} color="#1a3a6b" />
          <Resumen label="Abonado"  val={`$${fmt(totalAbonado)}`}color="#27ae60" />
          <Resumen label="Por cobrar" val={`$${fmt(totalSaldo)}`} color="#c0392b" />
        </div>

        {/* tabla */}
        <div style={{ overflowY: 'auto', maxHeight: 380 }}>
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                {['Nota','Fecha','Cliente','Prendas','Total','Abonado','Saldo','Forma pago'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 && !cargando && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#888' }}>Sin resultados para este período.</td></tr>
              )}
              {notas.map((n, i) => (
                <tr key={n.numnotaent} style={{ background: i % 2 === 0 ? '#fff' : '#f5f7fc', fontSize: 12 }}>
                  <td style={{ ...S.td, fontWeight: 700, color: '#1a3a6b' }}>{n.numnotaent}</td>
                  <td style={S.td}>{n.fechanotae}</td>
                  <td style={S.td}>{n.nombreclie}</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>{n.cantotal || 0}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>${fmt(n.valtotal)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: '#27ae60' }}>${fmt(n.valabono)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: (n.saldo || 0) > 0 ? '#c0392b' : '#27ae60', fontWeight: 700 }}>${fmt(n.saldo)}</td>
                  <td style={S.td}>{n.formapago}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Resumen({ label, val, color, sinFormato }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || '#333' }}>{val}</div>
    </div>
  )
}

const S = {
  fondo:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:       { background: '#fff', borderRadius: 8, padding: 20, width: 780, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
  cabecera:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 15, fontWeight: 800, color: '#1a3a6b' },
  btnX:        { background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 },
  filtros:     { display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 14, background: '#f0f4ff', padding: 10, borderRadius: 6, border: '1px solid #c8d5ea' },
  lbl:         { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 700, color: '#1a3a6b' },
  inp:         { height: 26, border: '1px solid #aab8d4', borderRadius: 3, padding: '0 6px', fontSize: 12, outline: 'none', marginTop: 2 },
  btnBuscar:   { background: '#2980b9', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, height: 32, alignSelf: 'flex-end' },
  bandaTotales:{ display: 'flex', gap: 4, background: '#eef2ff', border: '1px solid #c8d5ea', borderRadius: 6, padding: '10px 0', marginBottom: 12 },
  tabla:       { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  thead:       { background: '#dde3ee', position: 'sticky', top: 0 },
  th:          { padding: '5px 8px', fontWeight: 700, color: '#1a3a6b', borderBottom: '2px solid #aab8d4', textAlign: 'left', whiteSpace: 'nowrap' },
  td:          { padding: '5px 8px', borderBottom: '1px solid #eee' },
}
