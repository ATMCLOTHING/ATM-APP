import { useState } from 'react'

export default function ModalNuevaMarca({ supabase, onGuardar, onClose }) {
  const [descmarca, setDescmarca] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function guardar() {
    if (!descmarca.trim()) { setErr('Ingresa el nombre de la marca.'); return }
    setBusy(true)
    const {data, error} = await supabase.from('marcas')
      .insert({descmarca: descmarca.trim().toUpperCase()})
      .select().single()
    if (error) { setErr(error.message); setBusy(false); return }
    onGuardar(data)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span>➕ NUEVA MARCA</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        {err && <div style={S.err}>{err}</div>}
        <label style={S.lbl}>Nombre de la marca
          <input autoFocus style={S.inp} value={descmarca}
            onChange={e=>setDescmarca(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&guardar()}
            placeholder="Ej: TOUCH, HITECH…"/>
        </label>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}>
          <button onClick={onClose} style={S.btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={busy} style={S.btnOk}>
            {busy?'Guardando…':'💾 Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:  {position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400},
  modal:  {background:'#fff',borderRadius:8,padding:20,width:340,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'},
  titulo: {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,fontSize:14,fontWeight:800,color:'#1a3a6b'},
  btnX:   {background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700},
  err:    {background:'#ffebee',color:'#c62828',border:'1px solid #ef9a9a',borderRadius:4,padding:'5px 10px',marginBottom:10,fontSize:12},
  lbl:    {display:'flex',flexDirection:'column',gap:4,fontSize:11,fontWeight:700,color:'#1a3a6b'},
  inp:    {height:30,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 10px',fontSize:13,outline:'none',marginTop:3},
  btnCan: {background:'#888',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
  btnOk:  {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
}
