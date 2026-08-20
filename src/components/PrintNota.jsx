// src/components/PrintNota.jsx
// Formatos de impresión: Ticket (80mm) y Factura (Media Carta / Carta, según cantidad de ítems)

import { fmtFecha } from '../lib/fecha'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})
// El ticket replica el formato del sistema anterior: separador de miles con coma y sin decimales.
const fmtInt = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})

// Umbral de ítems a partir del cual la factura ya no cabe completa (tabla + totales + firmas
// + observaciones/devoluciones) en una hoja media carta (5.5in x 8.5in) y debe imprimirse en
// carta completa. Verificado a mano con el layout actual: 7 ítems llenan justo los 4.5in de
// contenido disponibles; 8 ya se pasa.
const UMBRAL_MEDIA_CARTA = 7

// ── Guía de envío: etiqueta con los datos del destinatario, para pegar en el paquete ──
// Se genera directamente desde la nota de entrega (botón 📍), sin pasar por el modal de impresión.
// Se imprime siempre en tamaño carta (8.5x11in) porque es el tamaño que cualquier impresora
// soporta de forma confiable — un tamaño de página "media carta" personalizado (5.5x8.5in)
// depende de que el controlador de la impresora lo reconozca, y muchos lo ignoran e imprimen
// igual en carta, dejando el contenido chico en una esquina. Por eso el contenido se estira con
// flexbox para llenar la mitad superior de la hoja carta en vez de depender de un tamaño de
// página que la impresora podría no respetar.
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
    <html><head><meta charset="UTF-8"><title>Guía de envío ${nroDoc}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { height: 100%; }
      body { font-family: Arial, sans-serif; font-size: 20px; color:#111; padding: 20mm 18mm; }
      .caja { border: 3px solid #1a3a6b; border-radius: 10px; padding: 34px 40px;
              height: 4.6in; display:flex; flex-direction:column; justify-content:space-between; }
      .rmte { font-size: 17px; color:#333; border-bottom: 3px solid #1a3a6b; padding-bottom: 16px; }
      .rmte-nombre { font-weight:900; font-size:21px; color:#1a3a6b; }
      .fila { display:flex; justify-content:space-between; }
      .destinatario { display:flex; flex-direction:column; justify-content:center; gap:20px; flex:1; }
      .dest-nombre { font-weight:900; font-size:40px; color:#111; line-height:1.15; }
      .dest-empresa { font-size:22px; color:#333; }
      .campo { font-size:21px; }
      .campo b { color:#1a3a6b; }
      .nota-ref { text-align:right; font-size:14px; color:#888; }
      @page { size: letter portrait; margin: 0; }
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

        <div class="destinatario">
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

  // Réplica exacta del ticket del sistema anterior (misma información, misma distribución,
  // misma tipografía): sin logo ni mensajes de cortesía que ese ticket no tenía, con las
  // mismas etiquetas de campo (incluida su puntuación tal cual, p.ej. "Nit.:" vs "Ciudad" sin
  // dos puntos) y números con coma de miles y sin decimales.
  function imprimirTicket() {
    const w = window.open('','_blank','width=320,height=600')
    w.document.write(`
      <html><head><meta charset="UTF-8"><title>Ticket ${nroDoc}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 280px; padding: 8px; color:#000; }
        .fila { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .titulo-row { font-size: 16px; margin-bottom: 6px; }
        .campo { display: flex; margin-bottom: 2px; }
        .campo .lbl { width: 64px; flex-shrink: 0; font-weight: bold; }
        .campo .val { flex: 1; }
        .header-tabla { margin: 8px 0 3px; }
        .total-fila { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; }
        .item-box { display: flex; gap: 6px; margin-bottom: 4px; }
        .item-num { width: 14px; flex-shrink: 0; }
        .item-body { flex: 1; min-width: 0; }
        .item-desc { margin-bottom: 1px; }
        @page { size: 80mm auto; margin: 0; }
        @media print { body { width: 72mm; margin: 0 auto; } }
      </style></head><body>
      <div class="fila bold titulo-row"><span>NOTA ENTREGA</span><span>${fmtInt(nroDoc)}</span></div>
      <div class="campo"><span class="lbl">Nit.:</span><span class="val">${cedula||'99'}</span></div>
      <div class="campo"><span class="lbl">Cliente:</span><span class="val">${cliente?.nombre||cliTxt}</span></div>
      <div class="campo"><span class="lbl">Dirección:</span><span class="val">${cliente?.direccion||''}</span></div>
      <div class="campo"><span class="lbl">Ciudad</span><span class="val">${cliente?.ciudad||''}</span></div>
      <div class="campo"><span class="lbl">Celular</span><span class="val">${cliente?.celular||''}</span></div>
      <div class="campo"><span class="lbl">Fecha</span><span class="val">${fmtFecha(fecha)}</span></div>
      <div class="campo"><span class="lbl">Vence:</span><span class="val">${fmtFecha(fechaPago)}</span></div>
      <div class="campo"><span class="lbl">Vendió:</span><span class="val">${vendedor?.nombre||''}</span></div>
      <div class="fila bold header-tabla"><span>TEM CODIGO</span><span>ARTICULO</span></div>
      ${(lineas||[]).map((l,i)=>`
        <div class="item-box">
          <div class="item-num">${i+1}</div>
          <div class="item-body">
            <div class="item-desc">${l.codartic} ${l.descartic||''}${l.marca?' - '+l.marca:''}</div>
            <div class="fila">
              <span>${l.cantidad}</span>
              <span>${fmtInt(l.valunit)}</span>
              <span class="bold">${fmtInt(l.valtotal)}</span>
            </div>
          </div>
        </div>
      `).join('')}
      <div style="margin-top:6px;">
        <div class="fila"><span>Sub-Total $</span><span>${fmtInt(subtotal)}</span></div>
        <div class="fila"><span>Dscto $</span><span>${fmtInt(totDcto)}</span></div>
        <div class="fila"><span>Iva $</span><span>${fmtInt(totIva)}</span></div>
        <div class="total-fila"><span>TOTAL</span><span>$${fmtInt(total)}</span></div>
        ${abonos>0?`<div class="fila"><span>Abonado $</span><span>${fmtInt(abonos)}</span></div>`:''}
        ${saldo>0?`<div class="total-fila"><span>SALDO</span><span>$${fmtInt(saldo)}</span></div>`:''}
      </div>
      </body></html>
    `)
    w.document.close(); w.focus()
    setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  // El sistema decide el tamaño de hoja según la cantidad de ítems: si todo (tabla + totales +
  // firmas) cabe en media carta, imprime media carta; si no, usa carta completa. Siempre en una
  // sola hoja: se fija el tamaño de página (@page) explícitamente y se evita el salto de página
  // dentro de la tabla/totales/firmas, que era la causa de que antes siempre salieran 2 hojas.
  // Se imprime siempre en tamaño carta (8.5x11in): es el único tamaño que cualquier impresora
  // soporta de forma confiable. Un "media carta" con tamaño de página personalizado depende de
  // que el controlador de la impresora lo reconozca, y muchos lo ignoran e imprimen igual en
  // carta, dejando el contenido chico en una esquina de la hoja — eso era lo que estaba pasando.
  // Por eso ahora, si la nota tiene pocos ítems, el contenido se estira con flexbox para llenar
  // la mitad superior de la hoja carta; si tiene más ítems, fluye de forma natural y usa toda la
  // hoja. En ambos casos es una sola hoja física (se evita el salto de página dentro de la tabla,
  // los totales y las firmas).
  function imprimirFactura() {
    const nItems  = (lineas||[]).length
    const esMedia = nItems <= UMBRAL_MEDIA_CARTA
    const fuenteBase= 11
    const firmaTop  = 10

    const w = window.open('','_blank','width=800,height=600')
    w.document.write(`
      <html><head><meta charset="UTF-8"><title>Nota ${nroDoc}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body { height: 100%; }
        body { font-family: Arial, sans-serif; font-size: ${fuenteBase}px; padding: 6mm 9mm; color: #111; }
        .doc-wrap { display:flex; flex-direction:column; }
        .doc-wrap.media { min-height: 4.5in; justify-content:space-between; }
        .header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; border-bottom:2px solid #1a3a6b; padding-bottom:3px; }
        .subtitulo { font-size:10px; color:#5577aa; letter-spacing:1px; text-transform:uppercase; font-weight:700; }
        .doc-titulo { font-size:17px; font-weight:800; color:#1a3a6b; }
        .doc-num { color:#c0392b; font-weight:900; }
        .seccion { background:#f5f7fb; border:1px solid #c8d5ea; border-radius:4px; padding:4px 10px; margin-bottom:4px; }
        .grid2 { display:grid; grid-template-columns:2fr 1fr; gap:5px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px; }
        .grid4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:5px; }
        .campo { display:flex; flex-direction:column; }
        .campo-lbl { font-size:9px; font-weight:700; color:#5577aa; text-transform:uppercase; }
        .campo-val { font-size:${fuenteBase}px; font-weight:600; border-bottom:1px solid #ddd; padding-bottom:2px; min-height:14px; overflow-wrap:break-word; }
        .campo-val.cliente-nombre { font-size:16px; font-weight:800; color:#111; }
        /* table-layout fijo + colgroup: los anchos de columna quedan iguales en cualquier
           navegador/impresora — con layout automático el ancho se recalcula según el
           contenido y la fuente instalada en cada equipo, que es lo que rompía el cuadro. */
        table { width:100%; table-layout:fixed; border-collapse:collapse; margin-bottom:4px; font-size:${fuenteBase-1}px; page-break-inside:avoid; }
        th { background:#1a3a6b; color:#fff; padding:3px 5px; text-align:center; font-size:${fuenteBase-1}px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        td { padding:2px 5px; border-bottom:1px solid #eee; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        td.item-n { text-align:center; background:#eef2ff; font-weight:700; color:#1a3a6b; }
        tr:nth-child(even) { background:#f5f7fc; }
        .totales { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; background:#f0f4ff; border:1px solid #c8d5ea; border-radius:4px; padding:5px 12px; page-break-inside:avoid; }
        .tot-lbl { font-size:9px; color:#5577aa; font-weight:700; text-align:center; text-transform:uppercase; }
        .tot-val { font-size:${fuenteBase}px; text-align:right; font-weight:700; color:#1a3a6b; }
        .tot-saldo { color:#c0392b; font-size:13px; }
        .cierre-extra { display:flex; gap:8px; margin-top:6px; page-break-inside:avoid; }
        .obs-box, .devol-box { flex:1; height:48px; border:1px solid #c8d5ea; border-radius:4px; }
        .firma { display:flex; justify-content:space-around; margin-top:${firmaTop}px; page-break-inside:avoid; }
        .linea-firma { border-top:1px solid #333; width:150px; padding-top:4px; text-align:center; font-size:9px; color:#555; }
        @page { size: letter portrait; margin: 0; }
      </style></head><body>

      <div class="doc-wrap ${esMedia?'media':''}">
        <div class="bloque-datos">
          <div class="header">
            <div class="subtitulo">A Tu Medida — Control de Inventarios</div>
            <div class="doc-titulo">NOTA DE ENTREGA <span class="doc-num">N° ${nroDoc}</span></div>
          </div>

          <div class="seccion">
            <div class="grid2" style="margin-bottom:4px;">
              <div class="campo"><span class="campo-lbl">Cliente</span><span class="campo-val cliente-nombre">${cliente?.nombre||cliTxt}</span></div>
              <div class="campo"><span class="campo-lbl">Cédula / NIT</span><span class="campo-val">${cedula||'99'}</span></div>
            </div>
            <div class="grid3">
              <div class="campo"><span class="campo-lbl">Dirección</span><span class="campo-val">${cliente?.direccion||''}</span></div>
              <div class="campo"><span class="campo-lbl">Ciudad</span><span class="campo-val">${cliente?.ciudad||''}</span></div>
              <div class="campo"><span class="campo-lbl">Celular</span><span class="campo-val">${cliente?.celular||''}</span></div>
            </div>
          </div>

          <div class="grid4" style="margin-bottom:6px;">
            <div class="campo"><span class="campo-lbl">Fecha</span><span class="campo-val">${fmtFecha(fecha)}</span></div>
            <div class="campo"><span class="campo-lbl">Forma de pago</span><span class="campo-val">${plazo}</span></div>
            <div class="campo"><span class="campo-lbl">Fecha de pago</span><span class="campo-val">${fmtFecha(fechaPago)}</span></div>
            <div class="campo"><span class="campo-lbl">Vendedor</span><span class="campo-val">${vendedor?.nombre||cedVend||''}</span></div>
          </div>
        </div>

        <div class="bloque-tabla">
          <table>
            <colgroup>
              <col style="width:6%"><col style="width:10%"><col style="width:33%"><col style="width:10%">
              <col style="width:9%"><col style="width:7%"><col style="width:12%"><col style="width:13%">
            </colgroup>
            <thead>
              <tr>
                <th>Ítem</th><th>Código</th><th>Descripción</th><th>Marca</th><th>Género</th>
                <th>Cant.</th><th>$ Unidad</th><th>$ Total</th>
              </tr>
            </thead>
            <tbody>
              ${(lineas||[]).map((l,i)=>`
                <tr>
                  <td class="item-n">${i+1}</td>
                  <td>${l.codartic}</td>
                  <td title="${l.descartic}">${l.descartic}</td>
                  <td>${l.marca||''}</td>
                  <td>${l.genero||''}</td>
                  <td style="text-align:center;font-weight:700">${l.cantidad}</td>
                  <td style="text-align:right">$${fmt(l.valunit)}</td>
                  <td style="text-align:right;font-weight:700">$${fmt(l.valtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="bloque-cierre">
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

          <div class="cierre-extra">
            <div class="obs-box"></div>
            <div class="devol-box"></div>
          </div>

          <div class="firma">
            <div class="linea-firma">Firma cliente</div>
            <div class="linea-firma">Firma vendedor</div>
            <div class="linea-firma">Recibido conforme</div>
          </div>
        </div>
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
