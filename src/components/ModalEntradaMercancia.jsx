// src/components/ModalEntradaMercancia.jsx
// Modal para registrar ingreso de unidades a un artículo existente.
// Mueve articomp, articulo y artikardex en una sola operación.

import { useState, useEffect } from 'react'

const CONCEPTOS = [
  'Segundo lote',
  'Segundas a primeras',
  'Ajuste de inventario',
  'Devolución de proveedor',
  'Corrección de conteo físico',
  'Bonificación de proveedor',
  'Traslado entre bodegas',
  'Otro',
]

const fmt = n => Number(n||0).toLocaleString('es-CO', {minimumFractionDigits:0})

export default function ModalEntradaMercancia({ supabase, articulo, usuario, onGuardado, onClose }) {
  const [cantidad,   setCantidad]   = useState('')
  const [concepto,  setConcepto]   = useState(CONCEPTOS[0])
  const [obs,       setObs]        = useState('')
  const [existActual, setExistActual] = useState(null)
  const [busy,      setBusy]       = useState(false)
  const [err,       setErr]        = useState('')

  useEffect(() => {
    // Cargar existencia actual de articomp (talla U)
    supabase.from('articomp')
      .select('existencia')
      .eq('codartic', articulo.codartic)
      .eq('talla', 'U')
      .limit(1)
      .then(({ data }) => {
        setExistActual(data && data.length ? Number(data[0].existencia) : Number(articulo.existencia||0))
      })
  }, [])

  async function guardar() {
    const cant = Number(cantidad)
    if (!cant || cant <= 0) { setErr('Ingresa una cantidad mayor a cero.'); return }
    setBusy(true); setErr('')
    try {
      const existAntes  = existActual
      const existDespues = existAntes + cant

      // 1) Actualizar articomp
      await supabase.from('articomp')
        .update({ existencia: existDespues })
        .eq('codartic', articulo.codartic)
        .eq('talla', 'U')

      // 2) Actualizar articulo (recalcula sumando todas las tallas)
      const { data: compRows } = await supabase.from('articomp')
        .select('existencia')
        .eq('codartic', articulo.codartic)
      const totalExist = (compRows||[]).reduce((s,r) => s + Number(r.existencia||0), 0)
      await supabase.from('articulo')
        .update({ existencia: totalExist })
        .eq('codartic', articulo.codartic)

      // 3) Registrar en kardex
      await supabase.from('artikardex').insert({
        codartic:          articulo.codartic,
        descartic:         articulo.descartic,
        talla:             'U',
        tipo_mov:          'ENTRADA',
        concepto:          concepto + (obs.trim() ? ` — ${obs.trim()}` : ''),
        cantidad:          cant,
        existencia_antes:  existAntes,
        existencia_despues: existDespues,
        usuario:           usuario?.usuario || usuario?.nombre || 'sistema',
      })

      onGuardado(totalExist)
    } catch(e) {
      setErr('Error al guardar: ' + e.message)
      setBusy(false)
    }
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span><span style={{fontSize:18}}>📦</span> ENTRADA DE MERCANCÍA</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {/* Info del artículo */}
        <div style={S.info}>
          <div style={{fontWeight:800, color:'#1a3a6b', fontSize:14}}>{articulo.descartic}</div>
          <div style={{fontSize:12, color:'#666', marginTop:2}}>
            Código: {articulo.codartic}
            {articulo.marca ? ` · Marca: ${articulo.marca}` : ''}
          </div>
          <div style={{marginTop:6, fontSize:13}}>
            Existencia actual: <strong style={{color:'#1a3a6b', fontSize:15}}>
              {existActual !== null ? fmt(existActual) : '…'}
            </strong> unidades
          </div>
        </div>

        {err && <div style={S.err}>{err}</div>}

        {/* Cantidad */}
        <label style={S.lbl}>Cantidad a ingresar
          <input autoFocus type="number" min={1} style={S.inp}
            value={cantidad} onChange={e => { setCantidad(e.target.value); setErr('') }}
            onKeyDown={e => e.key === 'Enter' && guardar()}
            placeholder="Ej: 50"/>
        </label>

        {/* Vista previa de nueva existencia */}
        {cantidad > 0 && existActual !== null && (
          <div style={S.preview}>
            Nueva existencia: <strong style={{color:'#2e7d32', fontSize:15}}>
              {fmt(existActual + Number(cantidad))}
            </strong> unidades
          </div>
        )}

        {/* Concepto */}
        <label style={S.lbl}>Concepto
          <select style={S.inp} value={concepto} onChange={e => setConcepto(e.target.value)}>
            {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {/* Observación adicional */}
        <label style={S.lbl}>Observación (opcional)
          <input style={S.inp} value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Detalle adicional…" maxLength={120}/>
        </label>

        <div style={{display:'flex', gap:8, marginTop:16, justifyContent:'flex-end'}}>
          <button onClick={onClose} style={S.btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={busy} style={S.btnOk}>
            {busy ? 'Guardando…' : <><span style={{fontSize:17}}>📦</span> Registrar entrada</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500 },
  modal:   { background:'#fff', borderRadius:10, padding:22, width:420, boxShadow:'0 8px 32px rgba(0,0,0,0.25)', display:'flex', flexDirection:'column', gap:12 },
  titulo:  { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:14, fontWeight:900, color:'#1a3a6b' },
  btnX:    { background:'#e74c3c', color:'#fff', border:'none', borderRadius:4, padding:'2px 9px', cursor:'pointer', fontWeight:900, fontSize:20 },
  info:    { background:'#f4f6fb', border:'1px solid #c8d5ea', borderRadius:6, padding:'10px 12px' },
  err:     { background:'#ffebee', color:'#c62828', border:'1px solid #ef9a9a', borderRadius:4, padding:'6px 10px', fontSize:12 },
  preview: { background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:6, padding:'8px 12px', fontSize:13, color:'#333' },
  lbl:     { display:'flex', flexDirection:'column', gap:4, fontSize:11, fontWeight:700, color:'#1a3a6b' },
  inp:     { height:32, border:'1px solid #c8d5ea', borderRadius:4, padding:'0 10px', fontSize:13, outline:'none', marginTop:2 },
  btnCan:  { background:'#888', color:'#fff', border:'none', borderRadius:6, padding:'8px 18px', cursor:'pointer', fontWeight:700 },
  btnOk:   { background:'#1a3a6b', color:'#fff', border:'none', borderRadius:6, padding:'8px 18px', cursor:'pointer', fontWeight:700 },
}
