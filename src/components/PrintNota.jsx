// src/components/PrintNota.jsx
// Formatos de impresión: Ticket (80mm) y Factura (Media Carta / Carta, según cantidad de ítems)

import { LOGO } from '../lib/assets'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})

// Umbral de ítems a partir del cual la factura ya no cabe completa (tabla + totales + firmas)
// en una hoja media carta (5.5in x 8.5in) y debe imprimirse en carta completa.
const UMBRAL_MEDIA_CARTA = 8

// ── Guía de envío: etiqueta con los datos del destinatario, para pegar en el paquete ──
// Se genera directamente desde la nota de entrega (botón 📍), sin pasar por el modal de impresión.
export function generarGuiaEnvio({ nroDoc, cliente, cliTxt, cedula }) {
  const w = window.open('','_blank','width=650,height=500')
  const nombre    = cliente?.nombre || cliTxt || ''
  const empresa   = cliente?.nom_empresa || ''
  const direccion = cliente?.direccion || ''
  const ciudad    = cliente?.ciudad || ''
  const depto     = cliente?.departamento || ''
  const celular   = cliente?.celular || ''
  const cedCli    = cliente?.cedula || cedula || ''
  w.document.write(`
    <html><head><title>Guía de envío ${nroDoc}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 20px; color:#111; padding: 28px 32px; }
      .caja { border: 3px solid #1a3a6b; border-radius: 8px; padding: 30px 34px; height: 100%; }
      .rmte { font-size: 17px; color:#333; border-bottom: 3px solid #1a3a6b; padding-bottom: 16px; margin-bottom: 30px; }
      .rmte-nombre { font-weight:900; font-size:21px; color:#1a3a6b; }
      .fila { display:flex; justify-content:space-between; }
      .dest-nombre { font-weight:900; font-size:38px; color:#111; margin-bottom:12px; line-height:1.15; }
      .dest-empresa { font-size:21px; color:#333; margin-bottom:22px; }
      .campo { font-size:20px; margin-bottom:20px; }
      .campo b { color:#1a3a6b; }
      .nota-ref { text-align:right; font-size:14px; color:#888; margin-top:40px; }
      @page { size: 5.5in 8.5in; margin: 10mm; }
    </style></head><body>
      <div class="caja">
        <div class="rmte">
          <div class="fila">
            <span>RMTE: <span class="rmte-nombre">A TU MEDIDA SAS</span></span>
            <span>NIT: 901.575-082-1</span>
          </div>
          <div>CALLE 49 # 53-79 C.C. LOS PANCHES Local 313</div>
          <div class="fila">
            <span>CEL: 322 5309608</span>
            <span style="font-weight:700;">MEDELLÍN</span>
          </div>
        </div>

        <div class="dest-nombre">${nombre}</div>
        ${empresa?`<div class="dest-empresa">${empresa}</div>`:''}
        <div class="fila campo">
          <span><b>C.C.</b> ${cedCli}</span>
          <span><b>CEL:</b> ${celular}</span>
        </div>
        <div class="campo"><b>DIR:</b> ${direccion}</div>
        <div class="fila campo">
          <span><b>CIUDAD:</b> ${ciudad}</span>
          <span><b>DEPTO:</b> ${depto}</span>
        </div>
        <div class="nota-ref">Nota de entrega N° ${nroDoc}</div>
      </div>
    </body></html>
  `)
  w.document.close(); w.focus()
  setTimeout(()=>{ w.print(); w.close() }, 400)
}

export default function PrintNota({ datos, onClose }) {
  const {
    nroDoc, fecha, fechaPago, plazo, medio,
    cliente, cliTxt, cedula, vendedor, cedVend,
    lineas, subtotal, totDcto, totIva, total, saldo, prendas, abonos,
  } = datos

  function imprimirTicket() {
    const w = window.open('','_blank','width=320,height=600')
    w.document.write(`
      <html><head><title>Ticket ${nroDoc}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Courier New', monospace; font-size: 11px; width: 280px; padding: 8px; }
        .centro { text-align: center; }
        .bold { font-weight: bold; }
        .grande { font-size: 14px; }
        .sep { border-top: 1px dashed #000; margin: 4px 0; }
        .fila { display: flex; justify-content: space-between; }
        .total-fila { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; }
        .item-box { display: flex; gap: 6px; margin-bottom: 3px; }
        .item-num { width: 14px; flex-shrink: 0; font-weight: bold; }
        .item-body { flex: 1; min-width: 0; }
        @page { size: 80mm auto; margin: 0; }
        @media print { body { width: 72mm; margin: 0 auto; } }
      </style></head><body>
      <div class="centro bold grande">A TU MEDIDA</div>
      <div class="centro">NOTA DE ENTREGA</div>
      <div class="centro bold">N° ${nroDoc}</div>
      <div class="sep"></div>
      <div class="fila"><span>Nit:</span><span>${cedula||'99'}</span></div>
      <div class="fila"><span>Cliente:</span><span>${cliente?.nombre||cliTxt}</span></div>
      <div class="fila"><span>Ciudad:</span><span>${cliente?.ciudad||''}</span></div>
      <div class="fila"><span>Celular:</span><span>${cliente?.celular||''}</span></div>
      <div class="fila"><span>Fecha:</span><span>${fecha}</span></div>
      <div class="fila"><span>Vence:</span><span>${fechaPago}</span></div>
      <div class="fila"><span>Vendió:</span><span>${vendedor?.nombre||''}</span></div>
      <div class="sep"></div>
      <div class="fila bold"><span>IT.</span><span style="flex:1;padding-left:6px;">CODIGO / ARTICULO</span></div>
      <div class="sep"></div>
      ${(lineas||[]).map((l,i)=>`
        <div class="item-box">
          <div class="item-num">${i+1}</div>
          <div class="item-body">
            <div class="fila">
              <span>${l.codartic}</span>
              <span>${(l.descartic||'').substring(0,18)} - ${l.talla||''}</span>
            </div>
            <div class="fila">
              <span>${l.cantidad} u.</span>
              <span>${fmt(l.valunit)}</span>
              <span class="bold">${fmt(l.valtotal)}</span>
            </div>
          </div>
        </div>
      `).join('')}
      <div class="sep"></div>
      <div class="fila"><span>Sub-Total $</span><span>${fmt(subtotal)}</span></div>
      <div class="fila"><span>Dscto $</span><span>${fmt(totDcto)}</span></div>
      <div class="fila"><span>Iva $</span><span>${fmt(totIva)}</span></div>
      <div class="sep"></div>
      <div class="total-fila"><span>TOTAL</span><span>$${fmt(total)}</span></div>
      ${abonos>0?`<div class="fila"><span>Abonado $</span><span>${fmt(abonos)}</span></div>`:''}
      ${saldo>0?`<div class="total-fila"><span>SALDO</span><span>$${fmt(saldo)}</span></div>`:''}
      <div class="sep"></div>
      <div class="centro">Gracias por su compra</div>
      <div class="centro">A TU MEDIDA</div>
      <div style="height:6mm;"></div>
      </body></html>
    `)
    w.document.close(); w.focus()
    setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  // El sistema decide el tamaño de hoja según la cantidad de ítems: si todo (tabla + totales +
  // firmas) cabe en media carta, imprime media carta; si no, usa carta completa. Siempre en una
  // sola hoja: se fija el tamaño de página (@page) explícitamente y se evita el salto de página
  // dentro de la tabla/totales/firmas, que era la causa de que antes siempre salieran 2 hojas.
  function imprimirFactura() {
    const nItems  = (lineas||[]).length
    const esMedia = nItems <= UMBRAL_MEDIA_CARTA
    const pageSize  = esMedia ? '5.5in 8.5in' : '8.5in 11in'
    const pageMargin= esMedia ? '8mm' : '10mm'
    const bodyPad   = esMedia ? '12px 18px' : '18px 28px'
    const logoAlto  = esMedia ? 62 : 74
    const fuenteBase= esMedia ? 11 : 12
    const descMaxW  = esMedia ? '105px' : '190px'
    const firmaTop  = esMedia ? 20 : 34

    const w = window.open('','_blank','width=800,height=600')
    w.document.write(`
      <html><head><title>Nota ${nroDoc}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: ${fuenteBase}px; padding: ${bodyPad}; color: #111; }
        .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:2px solid #1a3a6b; padding-bottom:8px; }
        .logo-txt { font-size:26px; font-weight:900; color:#1a3a6b; letter-spacing:3px; }
        .subtitulo { font-size:10px; color:#5577aa; letter-spacing:2px; text-transform:uppercase; }
        .doc-titulo { font-size:18px; font-weight:800; color:#1a3a6b; }
        .seccion { background:#f5f7fb; border:1px solid #c8d5ea; border-radius:4px; padding:6px 10px; margin-bottom:8px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
        .grid4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px; }
        .campo { display:flex; flex-direction:column; }
        .campo-lbl { font-size:10px; font-weight:700; color:#5577aa; text-transform:uppercase; }
        .campo-val { font-size:12px; font-weight:600; border-bottom:1px solid #ddd; padding-bottom:2px; min-height:16px; }
        table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:${fuenteBase-1}px; page-break-inside:avoid; }
        th { background:#1a3a6b; color:#fff; padding:4px 5px; text-align:center; font-size:${fuenteBase-1}px; }
        td { padding:3px 5px; border-bottom:1px solid #eee; }
        td.item-n { text-align:center; background:#eef2ff; font-weight:700; color:#1a3a6b; }
        td.desc { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:${descMaxW}; }
        tr:nth-child(even) { background:#f5f7fc; }
        .totales { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; background:#f0f4ff; border:1px solid #c8d5ea; border-radius:4px; padding:6px 12px; page-break-inside:avoid; }
        .tot-lbl { font-size:10px; color:#5577aa; font-weight:700; text-align:center; text-transform:uppercase; }
        .tot-val { font-size:12px; text-align:right; font-weight:700; color:#1a3a6b; }
        .tot-saldo { color:#c0392b; font-size:14px; }
        .firma { display:flex; justify-content:space-around; margin-top:${firmaTop}px; page-break-inside:avoid; }
        .linea-firma { border-top:1px solid #333; width:150px; padding-top:4px; text-align:center; font-size:9px; color:#555; }
        @page { size: ${pageSize}; margin: ${pageMargin}; }
        @media print { body { padding: ${bodyPad}; } }
      </style></head><body>

      <div class="header">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${LOGO}" alt="ATM" style="height:${logoAlto}px;object-fit:contain;"/>
          <div class="subtitulo" style="font-size:11px;">A TU MEDIDA<br/>Control de Inventarios</div>
        </div>
        <div class="doc-titulo">NOTA DE ENTREGA</div>
      </div>

      <div class="seccion">
        <div class="grid3" style="margin-bottom:6px;">
          <div class="campo"><span class="campo-lbl">N° Nota</span><span class="campo-val" style="color:#c0392b;font-weight:900;">${nroDoc}</span></div>
          <div class="campo"><span class="campo-lbl">Cédula / NIT</span><span class="campo-val">${cedula||'99'}</span></div>
          <div class="campo"><span class="campo-lbl">Cliente</span><span class="campo-val">${cliente?.nombre||cliTxt}</span></div>
        </div>
        <div class="grid3">
          <div class="campo"><span class="campo-lbl">Dirección</span><span class="campo-val">${cliente?.direccion||''}</span></div>
          <div class="campo"><span class="campo-lbl">Ciudad</span><span class="campo-val">${cliente?.ciudad||''}</span></div>
          <div class="campo"><span class="campo-lbl">Celular</span><span class="campo-val">${cliente?.celular||''}</span></div>
        </div>
      </div>

      <div class="grid4" style="margin-bottom:8px;">
        <div class="campo"><span class="campo-lbl">Fecha</span><span class="campo-val">${fecha}</span></div>
        <div class="campo"><span class="campo-lbl">Forma de pago</span><span class="campo-val">${plazo}</span></div>
        <div class="campo"><span class="campo-lbl">Fecha de pago</span><span class="campo-val">${fechaPago}</span></div>
        <div class="campo"><span class="campo-lbl">Vendedor</span><span class="campo-val">${vendedor?.nombre||cedVend||''}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Ítem</th><th>Código</th><th>Descripción</th><th>Marca</th><th>Género</th>
            <th>Talla</th><th>Cant.</th><th>$ Unidad</th><th>%Dto</th><th>$Dto</th><th>$ Total</th>
          </tr>
        </thead>
        <tbody>
          ${(lineas||[]).map((l,i)=>`
            <tr>
              <td class="item-n">${i+1}</td>
              <td>${l.codartic}</td>
              <td class="desc" title="${l.descartic}">${l.descartic}</td>
              <td>${l.marca||''}</td>
              <td>${l.genero||''}</td>
              <td style="text-align:center">${l.talla}</td>
              <td style="text-align:center;font-weight:700">${l.cantidad}</td>
              <td style="text-align:right">$${fmt(l.valunit)}</td>
              <td style="text-align:right">${l.porcdescue||0}%</td>
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
        <span class="tot-val">$${fmt(totDcto)}</span>
        <span class="tot-val">$${fmt(totIva)}</span>
        <span class="tot-lbl" style="font-weight:900;color:#1a3a6b;">TOTAL</span>
        <span class="tot-lbl">Abonado</span>
        <span class="tot-lbl" style="color:#c0392b;">SALDO</span>
        <span class="tot-val" style="font-size:15px;">$${fmt(total)}</span>
        <span class="tot-val" style="color:#2e7d32;">$${fmt(abonos)}</span>
        <span class="tot-val tot-saldo">$${fmt(saldo)}</span>
      </div>

      <div class="firma">
        <div class="linea-firma">Firma cliente</div>
        <div class="linea-firma">Firma vendedor</div>
        <div class="linea-firma">Recibido conforme</div>
      </div>

      </body></html>
    `)
    w.document.close(); w.focus()
    setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span><span style={{fontSize:20}}>🖨</span> IMPRIMIR — Nota {nroDoc}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        <p style={{color:'#555',fontSize:13,marginBottom:20}}>
          Elige el formato de impresión:
        </p>
        <div style={{display:'flex',gap:16,justifyContent:'center'}}>
          <button onClick={imprimirTicket} style={S.btnTicket}>
            <span style={{fontSize:36}}>🧾</span><br/>
            <strong style={{fontSize:28}}>Ticket</strong><br/>
            <span style={{fontSize:11}}>Impresora térmica 80mm</span>
          </button>
          <button onClick={imprimirFactura} style={S.btnCarta}>
            <span style={{fontSize:36}}>📄</span><br/>
            <strong style={{fontSize:24}}>Carta / Media Carta</strong><br/>
            <span style={{fontSize:11}}>Impresora normal / PDF — el tamaño se ajusta solo</span>
          </button>
        </div>
        <div style={{textAlign:'right',marginTop:20}}>
          <button onClick={onClose} style={S.btnCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:    {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300},
  modal:    {background:'#fff',borderRadius:10,padding:28,width:420,boxShadow:'0 12px 40px rgba(0,0,0,0.3)',textAlign:'center'},
  titulo:   {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,fontSize:15,fontWeight:900,color:'#1a3a6b'},
  btnX:     {background:'#e74c3c',color:'#fff',border:'none',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:900,fontSize:20},
  btnTicket:{background:'#f0f4ff',border:'2px solid #1a3a6b',borderRadius:10,padding:'20px 28px',cursor:'pointer',fontSize:28,color:'#1a3a6b',lineHeight:1.8},
  btnCarta: {background:'#f0fff4',border:'2px solid #2e7d32',borderRadius:10,padding:'20px 28px',cursor:'pointer',fontSize:28,color:'#2e7d32',lineHeight:1.8},
  btnCerrar:{background:'#888',color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',cursor:'pointer',fontWeight:700,fontSize:13},
}
