// src/components/ModalDetalle.jsx
// Vista de detalle ampliada de las líneas de la nota.

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ModalDetalle({ nroDoc, lineas, onClose }) {
  const detValidas = lineas.filter(l => l.codartic && (l.cantidad || 0) > 0)

  const totalPrendas = detValidas.reduce((s, l) => s + (l.cantidad || 0), 0)
  const totalVenta   = detValidas.reduce((s, l) => s + (l.valtotal || 0), 0)

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span>🔍 DETALLE — Nota {nroDoc}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        <table style={S.tabla}>
          <thead>
            <tr style={S.thead}>
              {['#','Cód.','Descripción','Talla','Cant.','$ Unit.','% Dcto.','$ Dcto.','% IVA','$ IVA','$ Total'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detValidas.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 20, color: '#888' }}>Sin artículos.</td></tr>
            )}
            {detValidas.map((l, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f5f7fc', fontSize: 12 }}>
                <td style={{ ...S.td, textAlign: 'center', color: '#888' }}>{i + 1}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#1a3a6b' }}>{l.codartic}</td>
                <td style={S.td}>{l.descartic}</td>
                <td style={{ ...S.td, textAlign: 'center' }}>{l.talla}</td>
                <td style={{ ...S.td, textAlign: 'center', fontWeight: 600 }}>{l.cantidad}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>${fmt(l.valunit)}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{l.porcdescue}%</td>
                <td style={{ ...S.td, textAlign: 'right', color: '#c0392b' }}>${fmt(l.valdescue)}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{l.porciva}%</td>
                <td style={{ ...S.td, textAlign: 'right' }}>${fmt(l.valiva)}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#1a3a6b' }}>${fmt(l.valtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#dde3ee', fontWeight: 700 }}>
              <td colSpan={4} style={{ ...S.td, textAlign: 'right', fontSize: 12 }}>TOTALES:</td>
              <td style={{ ...S.td, textAlign: 'center', fontSize: 13 }}>{totalPrendas}</td>
              <td colSpan={5} style={S.td}></td>
              <td style={{ ...S.td, textAlign: 'right', fontSize: 13, color: '#1a3a6b' }}>${fmt(totalVenta)}</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose} style={S.btnCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:    { background: '#fff', borderRadius: 8, padding: 20, width: 860, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
  cabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 15, fontWeight: 800, color: '#1a3a6b' },
  btnX:     { background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 17 },
  tabla:    { width: '100%', borderCollapse: 'collapse' },
  thead:    { background: '#dde3ee' },
  th:       { padding: '6px 8px', fontWeight: 700, color: '#1a3a6b', borderBottom: '2px solid #aab8d4', textAlign: 'left', fontSize: 11, whiteSpace: 'nowrap' },
  td:       { padding: '5px 8px', borderBottom: '1px solid #eee', fontSize: 12 },
  btnCerrar:{ background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 4, padding: '7px 18px', cursor: 'pointer', fontWeight: 700 },
}
