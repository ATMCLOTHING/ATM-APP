// src/components/PrintNota.jsx
// Vista de impresión de la Nota de Entrega.
// Se abre en un modal y usa window.print() para imprimir.

import { useEffect, useRef } from 'react'

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PrintNota({ datos, onClose }) {
  const ref = useRef()
  const {
    nroDoc, fecha, fechaPago, plazoPago, medioPago,
    cliente, clienteInput, cedVendedor, vendedor,
    lineas, subtotal, totalDescto, totalIva, total, saldo, cantPrendas, totalAbonos,
  } = datos

  const detValidas = (lineas || []).filter(l => l.codartic && (l.cantidad || 0) > 0)

  function imprimir() {
    const win = window.open('', '_blank', 'width=800,height=600')
    win.document.write(`
      <html>
      <head>
        <title>Nota de Entrega ${nroDoc}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; padding: 16px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #1a3a6b; padding-bottom: 8px; }
          .empresa { font-size: 20px; font-weight: 900; color: #1a3a6b; letter-spacing: 2px; }
          .subtitulo { font-size: 11px; color: #5577aa; }
          .titulo-doc { font-size: 16px; font-weight: 800; color: #1a3a6b; text-align: right; }
          .nro { font-size: 22px; font-weight: 900; color: #c0392b; text-align: right; }
          .seccion { background: #f0f4ff; border: 1px solid #c8d5ea; border-radius: 4px; padding: 8px 12px; margin-bottom: 8px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
          .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
          .campo { display: flex; flex-direction: column; }
          .campo-lbl { font-size: 9px; font-weight: 700; color: #5577aa; text-transform: uppercase; letter-spacing: 0.5px; }
          .campo-val { font-size: 12px; font-weight: 600; color: #111; border-bottom: 1px solid #ccc; padding-bottom: 1px; min-height: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th { background: #1a3a6b; color: #fff; padding: 5px 6px; font-size: 10px; text-align: center; }
          td { padding: 4px 6px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
          tr:nth-child(even) { background: #f5f7fc; }
          .totales { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; background: #f0f4ff; border: 1px solid #c8d5ea; border-radius: 4px; padding: 10px 14px; }
          .tot-lbl { font-size: 10px; color: #5577aa; font-weight: 700; text-transform: uppercase; text-align: center; }
          .tot-val { font-size: 13px; font-weight: 700; text-align: right; color: #1a3a6b; }
          .tot-val.saldo { color: #c0392b; }
          .tot-val.grande { font-size: 16px; }
          .firma { display: flex; justify-content: space-between; margin-top: 40px; }
          .linea-firma { border-top: 1px solid #333; width: 180px; padding-top: 4px; text-align: center; font-size: 10px; color: #555; }
          .prendas { text-align:right; font-size:12px; font-weight:800; color:#856404; background:#fff3cd; border:1px solid #ffc107; border-radius:4px; padding:4px 12px; margin-bottom:8px; display:inline-block; float:right; }
          @media print { body { padding: 8px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="empresa">ATM CLOTHING</div>
            <div class="subtitulo">A TU MEDIDA — Control de Inventarios</div>
          </div>
          <div>
            <div class="titulo-doc">NOTA DE ENTREGA</div>
            <div class="nro">No. ${nroDoc}</div>
            <div style="text-align:right;font-size:11px;color:#555;">Fecha: ${fecha}</div>
          </div>
        </div>

        <div class="seccion">
          <div class="grid2" style="margin-bottom:6px;">
            <div class="campo"><span class="campo-lbl">Cliente</span><span class="campo-val">${cliente?.nombreclie || clienteInput}</span></div>
            <div class="campo"><span class="campo-lbl">Cédula / NIT</span><span class="campo-val">${cliente?.cedrifclie || ''}</span></div>
          </div>
          <div class="grid3">
            <div class="campo"><span class="campo-lbl">Dirección</span><span class="campo-val">${cliente?.direcicion || ''}</span></div>
            <div class="campo"><span class="campo-lbl">Ciudad</span><span class="campo-val">${cliente?.ciudad || ''}</span></div>
            <div class="campo"><span class="campo-lbl">Celular</span><span class="campo-val">${cliente?.celular || ''}</span></div>
          </div>
        </div>

        <div class="grid3" style="margin-bottom:8px;gap:6px;display:grid;">
          <div class="campo"><span class="campo-lbl">Forma de pago</span><span class="campo-val">${plazoPago}</span></div>
          <div class="campo"><span class="campo-lbl">Fecha de pago</span><span class="campo-val">${fechaPago}</span></div>
          <div class="campo"><span class="campo-lbl">Vendedor</span><span class="campo-val">${vendedor?.nomvended || cedVendedor}</span></div>
        </div>

        <div class="prendas">Cantidad de prendas: ${cantPrendas}</div>
        <div style="clear:both;"></div>

        <table>
          <thead>
            <tr>
              <th>Código</th><th>Descripción</th><th>Talla</th><th>Cant.</th>
              <th>$ Unidad</th><th>% Dto.</th><th>$ Dto.</th><th>$ Total</th>
            </tr>
          </thead>
          <tbody>
            ${detValidas.map(l => `
              <tr>
                <td>${l.codartic}</td>
                <td>${l.descartic}</td>
                <td style="text-align:center">${l.talla}</td>
                <td style="text-align:center">${l.cantidad}</td>
                <td style="text-align:right">$${fmt(l.valunit)}</td>
                <td style="text-align:right">${l.porcdescue}%</td>
                <td style="text-align:right">$${fmt(l.valdescue)}</td>
                <td style="text-align:right;font-weight:700">$${fmt(l.valtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totales">
          <span class="tot-lbl">Subtotal</span>
          <span class="tot-lbl">Descuento</span>
          <span class="tot-lbl">IVA</span>
          <span class="tot-val">$${fmt(subtotal)}</span>
          <span class="tot-val">$${fmt(totalDescto)}</span>
          <span class="tot-val">$${fmt(totalIva)}</span>
          <span class="tot-lbl" style="font-weight:900;color:#1a3a6b;">TOTAL</span>
          <span class="tot-lbl">Abonado</span>
          <span class="tot-lbl" style="color:#c0392b;">SALDO</span>
          <span class="tot-val grande">$${fmt(total)}</span>
          <span class="tot-val">$${fmt(totalAbonos)}</span>
          <span class="tot-val saldo grande">$${fmt(saldo)}</span>
        </div>

        <div class="firma">
          <div class="linea-firma">Firma cliente</div>
          <div class="linea-firma">Firma vendedor</div>
          <div class="linea-firma">Recibido conforme</div>
        </div>
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span>🖨 Vista previa — Nota {nroDoc}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>
          Haz clic en <strong>Imprimir</strong> para abrir el diálogo de impresión.
          Puedes guardar como PDF si tu impresora lo permite.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}  style={{ ...S.btn, background: '#888' }}>Cancelar</button>
          <button onClick={imprimir} style={{ ...S.btn, background: '#1a3a6b' }}>🖨 Imprimir / Guardar PDF</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:    { background: '#fff', borderRadius: 8, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
  cabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 15, fontWeight: 800, color: '#1a3a6b' },
  btnX:     { background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 700 },
  btn:      { color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
}
