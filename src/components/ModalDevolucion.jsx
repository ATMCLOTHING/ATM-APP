// src/components/ModalDevolucion.jsx
// Modal para devolver una cantidad (parcial o total) de una prenda
// sobre una línea de una Nota de Entrega ya guardada.

import { useState } from 'react'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function ModalDevolucion({ linea, onConfirmar, onClose }) {
  const maxCant = Number(linea?.cantidad || 0)
  const [cantidad, setCantidad] = useState(maxCant > 0 ? 1 : 0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const precioUnitEfectivo = maxCant > 0 ? (Number(linea.valtotal||0) / maxCant) : 0
  const valorDevolucion = precioUnitEfectivo * Number(cantidad||0)

  async function confirmar() {
    const c = Number(cantidad)
    if (!c || c <= 0) { setErr('Ingresa una cantidad mayor a cero.'); return }
    if (c > maxCant) { setErr(`No puedes devolver más de ${maxCant}.`); return }
    setBusy(true)
    await onConfirmar(c)
    setBusy(false)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span><span style={{fontSize:18}}>↩</span> CANTIDAD A DEVOLVER</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        <div style={S.info}>
          <div style={{fontWeight:800,color:'#1a3a6b',fontSize:14}}>{linea?.descartic}</div>
          <div style={{fontSize:12,color:'#666'}}>
            Cód: {linea?.codartic} {linea?.talla ? `· Talla: ${linea.talla}` : ''} · Cantidad en la nota: {maxCant}
          </div>
        </div>

        {err && <div style={S.err}>{err}</div>}

        <label style={S.lbl}>Cantidad
          <input
            autoFocus type="number" style={S.inp}
            value={cantidad} min={1} max={maxCant}
            onChange={e=>{setCantidad(e.target.value); setErr('')}}
            onKeyDown={e=>e.key==='Enter'&&confirmar()}
          />
        </label>

        <div style={S.valor}>
          Valor de la devolución: <strong>${fmt(valorDevolucion)}</strong>
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <button onClick={onClose} style={S.btnCan}>Cancelar</button>
          <button onClick={confirmar} disabled={busy} style={S.btnOk}>
            {busy ? 'Procesando…' : <><span style={{fontSize:17}}>↩</span> Devolver</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:  {position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400},
  modal:  {background:'#fff',borderRadius:8,padding:20,width:360,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'},
  cabecera:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,fontSize:14,fontWeight:800,color:'#1a3a6b'},
  btnX:   {background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700,fontSize:17},
  info:   {background:'#f4f6fb',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 10px',marginBottom:12},
  err:    {background:'#ffebee',color:'#c62828',border:'1px solid #ef9a9a',borderRadius:4,padding:'5px 10px',marginBottom:10,fontSize:12},
  lbl:    {display:'flex',flexDirection:'column',gap:4,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:    {height:32,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 10px',fontSize:14,outline:'none',marginTop:3},
  valor:  {marginTop:12,fontSize:13,color:'#333',background:'#fff8e1',border:'1px solid #ffe082',borderRadius:6,padding:'8px 10px'},
  btnCan: {background:'#888',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
  btnOk:  {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
}
