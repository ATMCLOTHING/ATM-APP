// src/components/PrintNota.jsx
// Dos formatos de impresión: Ticket (80mm) y Media Carta

import { LOGO } from '../lib/assets'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})

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
        @page { size: 80mm auto; margin: 0; }
        @media print { body { width: 80mm; } }
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
      <div class="fila bold"><span>ITEM CODIGO</span><span>ARTICULO</span></div>
      <div class="sep"></div>
      ${(lineas||[]).map((l,i)=>`
        <div class="fila">
          <span>${i+1}    ${l.codartic}</span>
          <span>${(l.descartic||'').substring(0,18)} - ${l.talla||''}</span>
        </div>
        <div class="fila">
          <span>    ${l.cantidad}</span>
          <span>${fmt(l.valunit)}</span>
          <span class="bold">${fmt(l.valtotal)}</span>
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
      <br/><br/><br/>
      </body></html>
    `)
    w.document.close(); w.focus()
    setTimeout(()=>{ w.print(); w.close() }, 400)
  }

  function imprimirMediaCarta() {
    const w = window.open('','_blank','width=800,height=600')
    w.document.write(`
      <html><head><title>Nota ${nroDoc}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px 30px; color: #111; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:2px solid #1a3a6b; padding-bottom:10px; }
        .logo-txt { font-size:26px; font-weight:900; color:#1a3a6b; letter-spacing:3px; }
        .subtitulo { font-size:10px; color:#5577aa; letter-spacing:2px; text-transform:uppercase; }
        .doc-info { text-align:right; }
        .doc-titulo { font-size:16px; font-weight:800; color:#1a3a6b; }
        .doc-nro { font-size:22px; font-weight:900; color:#c0392b; }
        .seccion { background:#f5f7fb; border:1px solid #c8d5ea; border-radius:4px; padding:8px 12px; margin-bottom:10px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
        .campo { display:flex; flex-direction:column; }
        .campo-lbl { font-size:9px; font-weight:700; color:#5577aa; text-transform:uppercase; }
        .campo-val { font-size:11px; font-weight:600; border-bottom:1px solid #ddd; padding-bottom:1px; min-height:14px; }
        table { width:100%; border-collapse:collapse; margin-bottom:10px; font-size:10px; }
        th { background:#1a3a6b; color:#fff; padding:5px 6px; text-align:center; font-size:10px; }
        td { padding:4px 5px; border-bottom:1px solid #eee; }
        tr:nth-child(even) { background:#f5f7fc; }
        .totales { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; background:#f0f4ff; border:1px solid #c8d5ea; border-radius:4px; padding:8px 14px; }
        .tot-lbl { font-size:10px; color:#5577aa; font-weight:700; text-align:center; text-transform:uppercase; }
        .tot-val { font-size:12px; text-align:right; font-weight:700; color:#1a3a6b; }
        .tot-saldo { color:#c0392b; font-size:14px; }
        .firma { display:flex; justify-content:space-around; margin-top:40px; }
        .linea-firma { border-top:1px solid #333; width:160px; padding-top:4px; text-align:center; font-size:9px; color:#555; }
        @media print { body { padding:10px 20px; } }
      </style></head><body>

      <div class="header">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${LOGO}" alt="ATM" style="height:60px;object-fit:contain;"/>
          <div class="subtitulo" style="font-size:11px;">A TU MEDIDA<br/>Control de Inventarios</div>
        </div>
        <div class="doc-info">
          <div class="doc-titulo">NOTA DE ENTREGA</div>
          <div class="doc-nro">N° ${nroDoc}</div>
          <div style="font-size:10px;color:#555;">Fecha: ${fecha}</div>
        </div>
      </div>

      <div class="seccion">
        <div class="grid2" style="margin-bottom:6px;">
          <div class="campo"><span class="campo-lbl">Cédula / NIT</span><span class="campo-val">${cedula||'99'}</span></div>
          <div class="campo"><span class="campo-lbl">Cliente</span><span class="campo-val">${cliente?.nombre||cliTxt}</span></div>
        </div>
        <div class="grid3">
          <div class="campo"><span class="campo-lbl">Dirección</span><span class="campo-val">${cliente?.direccion||''}</span></div>
          <div class="campo"><span class="campo-lbl">Ciudad</span><span class="campo-val">${cliente?.ciudad||''}</span></div>
          <div class="campo"><span class="campo-lbl">Celular</span><span class="campo-val">${cliente?.celular||''}</span></div>
        </div>
      </div>

      <div class="grid3" style="margin-bottom:10px;gap:6px;display:grid;">
        <div class="campo"><span class="campo-lbl">Forma de pago</span><span class="campo-val">${plazo}</span></div>
        <div class="campo"><span class="campo-lbl">Fecha de pago</span><span class="campo-val">${fechaPago}</span></div>
        <div class="campo"><span class="campo-lbl">Vendedor</span><span class="campo-val">${vendedor?.nombre||cedVend||''}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th><th>Código</th><th>Descripción</th><th>Marca</th><th>Género</th>
            <th>Talla</th><th>Cant.</th><th>$ Unidad</th><th>%Dto</th><th>$Dto</th><th>$ Total</th>
          </tr>
        </thead>
        <tbody>
          ${(lineas||[]).map((l,i)=>`
            <tr>
              <td style="text-align:center">${i+1}</td>
              <td>${l.codartic}</td>
              <td>${l.descartic}</td>
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
          <span>🖨 IMPRIMIR — Nota {nroDoc}</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        <p style={{color:'#555',fontSize:13,marginBottom:20}}>
          Elige el formato de impresión:
        </p>
        <div style={{display:'flex',gap:16,justifyContent:'center'}}>
          <button onClick={imprimirTicket} style={S.btnTicket}>
            🧾<br/>
            <strong>Ticket</strong><br/>
            <span style={{fontSize:11}}>Impresora térmica 80mm</span>
          </button>
          <button onClick={imprimirMediaCarta} style={S.btnCarta}>
            📄<br/>
            <strong>Media Carta</strong><br/>
            <span style={{fontSize:11}}>Impresora normal / PDF</span>
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
  btnX:     {background:'#e74c3c',color:'#fff',border:'none',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:900,fontSize:15},
  btnTicket:{background:'#f0f4ff',border:'2px solid #1a3a6b',borderRadius:10,padding:'20px 28px',cursor:'pointer',fontSize:28,color:'#1a3a6b',lineHeight:1.8},
  btnCarta: {background:'#f0fff4',border:'2px solid #2e7d32',borderRadius:10,padding:'20px 28px',cursor:'pointer',fontSize:28,color:'#2e7d32',lineHeight:1.8},
  btnCerrar:{background:'#888',color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',cursor:'pointer',fontWeight:700,fontSize:13},
}
