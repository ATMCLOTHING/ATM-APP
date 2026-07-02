// src/components/ModalVale.jsx
// Busca un vale por su código y permite aplicarlo (total o parcial)
// como parte de pago de la Nota de Entrega actual.

import { useState } from 'react'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function ModalVale({ supabase, saldoNota, onAplicar, onClose }) {
  const [codigo,    setCodigo]    = useState('')
  const [vale,      setVale]      = useState(null)
  const [resultados,setResultados]= useState([])
  const [valor,     setValor]     = useState('')
  const [buscando,  setBuscando]  = useState(false)
  const [busy,      setBusy]      = useState(false)
  const [err,       setErr]       = useState('')

  async function buscar() {
    const txt = codigo.trim().toUpperCase()
    if (!txt) { setErr('Ingresa el código, nombre o cédula del cliente.'); return }
    setBuscando(true); setErr(''); setVale(null)
    const { data, error } = await supabase.from('vales').select('*')
      .or(`codigo.ilike.%${txt}%,cliente_nombre.ilike.%${txt}%,cliente_ced.ilike.%${txt}%`)
      .eq('estado', 'ACTIVO')
      .gt('saldo', 0)
      .order('fecregistr', { ascending: false })
      .limit(20)
    setBuscando(false)
    if (error || !data || !data.length) { setErr('No se encontraron vales activos con ese criterio.'); return }
    if (data.length === 1) {
      setVale(data[0])
      setValor(String(Math.min(data[0].saldo, saldoNota)))
    } else {
      setResultados(data)
    }
  }

  async function aplicar() {
    const val = Number(valor)
    if (!val || val <= 0) { setErr('Ingresa un valor válido.'); return }
    if (val > vale.saldo + 0.01) { setErr(`El valor supera el saldo disponible del vale ($${fmt(vale.saldo)}).`); return }
    if (val > saldoNota + 0.01) { setErr(`El valor supera el saldo pendiente de la nota ($${fmt(saldoNota)}).`); return }
    setBusy(true)
    await onAplicar(vale, val)
    setBusy(false)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.cabecera}>
          <span>🎫 APLICAR VALE COMO PAGO</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {err && <div style={S.err}>{err}</div>}

        {!vale && (
          <>
            <label style={S.lbl}>Código, nombre o cédula del cliente
              <div style={{display:'flex',gap:6}}>
                <input autoFocus style={{...S.inp,flex:1}} value={codigo}
                  onChange={e=>setCodigo(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&buscar()}
                  placeholder="Ej: V-000012 o nombre del cliente"/>
                <button onClick={buscar} disabled={buscando} style={S.btnBuscar}>
                  {buscando ? '…' : '🔍 Buscar'}
                </button>
              </div>
            </label>
            {resultados.length > 1 && (
              <div style={{marginTop:8}}>
                <div style={{fontSize:11,color:'#666',marginBottom:6}}>Se encontraron {resultados.length} vales — selecciona uno:</div>
                {resultados.map(r=>(
                  <div key={r.id} onClick={()=>{setVale(r);setValor(String(Math.min(r.saldo,saldoNota)));setResultados([])}}
                    style={{padding:'7px 10px',marginBottom:4,background:'#f4f6fb',border:'1px solid #c8d5ea',borderRadius:6,cursor:'pointer',fontSize:12}}>
                    <strong style={{color:'#1a3a6b'}}>{r.codigo}</strong> · {r.cliente_nombre} · Saldo: <strong style={{color:'#2e7d32'}}>${Number(r.saldo).toLocaleString('es-CO')}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {vale && (
          <>
            <div style={S.info}>
              <div style={{fontWeight:800,color:'#1a3a6b'}}>{vale.codigo}</div>
              <div style={{fontSize:12,color:'#666'}}>
                Cliente: {vale.cliente_nombre || 'No especificado'} · Emitido: {String(vale.fecregistr||'').slice(0,10)}
              </div>
              <div style={{fontSize:13,marginTop:4}}>
                Saldo disponible: <strong style={{color:'#2e7d32'}}>${fmt(vale.saldo)}</strong>
              </div>
            </div>
            <label style={S.lbl}>Valor a aplicar a esta nota
              <input type="number" style={S.inp} value={valor} min={0} max={Math.min(vale.saldo,saldoNota)}
                onChange={e=>{setValor(e.target.value);setErr('')}}
                onKeyDown={e=>e.key==='Enter'&&aplicar()}/>
            </label>
            <div style={{fontSize:11,color:'#888',marginTop:4}}>Saldo pendiente de la nota: ${fmt(saldoNota)}</div>
          </>
        )}

        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <button onClick={onClose} style={S.btnCan}>Cancelar</button>
          {vale && (
            <button onClick={aplicar} disabled={busy} style={S.btnOk}>
              {busy ? 'Aplicando…' : '✅ Aplicar vale'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:  {position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400},
  modal:  {background:'#fff',borderRadius:8,padding:20,width:380,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'},
  cabecera:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,fontSize:14,fontWeight:800,color:'#1a3a6b'},
  btnX:   {background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700},
  err:    {background:'#ffebee',color:'#c62828',border:'1px solid #ef9a9a',borderRadius:4,padding:'5px 10px',marginBottom:10,fontSize:12},
  info:   {background:'#f4f6fb',border:'1px solid #c8d5ea',borderRadius:6,padding:'8px 10px',marginBottom:12},
  lbl:    {display:'flex',flexDirection:'column',gap:4,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:    {height:32,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 10px',fontSize:14,outline:'none',marginTop:3},
  btnBuscar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:4,padding:'0 14px',cursor:'pointer',fontWeight:700,fontSize:13},
  btnCan: {background:'#888',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
  btnOk:  {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
}
