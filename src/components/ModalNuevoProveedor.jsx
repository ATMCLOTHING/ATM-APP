import { useState } from 'react'

export default function ModalNuevoProveedor({ supabase, onGuardar, onClose }) {
  const [form, setForm] = useState({
    nomproveed:'', cedrif:'', ciudad:'', telefono:'', celular:'',
    nombrevend:'', email:'', descprov:'', diaspago:0
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  function upd(k,v){setForm(p=>({...p,[k]:v}))}

  async function guardar() {
    if (!form.nomproveed.trim()) { setErr('El nombre es obligatorio.'); return }
    setBusy(true)
    const {data, error} = await supabase.from('proveedores')
      .insert({...form, nomproveed: form.nomproveed.toUpperCase()})
      .select().single()
    if (error) { setErr(error.message); setBusy(false); return }
    onGuardar(data)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span><span style={{fontSize:18}}>➕</span> NUEVO PROVEEDOR</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>
        {err && <div style={S.err}>{err}</div>}
        <div style={S.grid}>
          <Campo label="Cédula / NIT">
            <input style={S.inp} value={form.cedrif} onChange={e=>upd('cedrif',e.target.value)} placeholder="NIT o cédula"/>
          </Campo>
          <Campo label="Nombre / Razón Social" span={2}>
            <input autoFocus style={S.inp} value={form.nomproveed} onChange={e=>upd('nomproveed',e.target.value)} placeholder="Nombre del proveedor"/>
          </Campo>
          <Campo label="Descripción" span={2}>
            <input style={S.inp} value={form.descprov} onChange={e=>upd('descprov',e.target.value)} placeholder="Servicios, insumos…"/>
          </Campo>
          <Campo label="Ciudad">
            <input style={S.inp} value={form.ciudad} onChange={e=>upd('ciudad',e.target.value.toUpperCase())}/>
          </Campo>
          <Campo label="Teléfono">
            <input style={S.inp} value={form.telefono} onChange={e=>upd('telefono',e.target.value)}/>
          </Campo>
          <Campo label="Celular">
            <input style={S.inp} value={form.celular} onChange={e=>upd('celular',e.target.value)}/>
          </Campo>
          <Campo label="Contacto">
            <input style={S.inp} value={form.nombrevend} onChange={e=>upd('nombrevend',e.target.value)}/>
          </Campo>
          <Campo label="Email" span={2}>
            <input type="email" style={S.inp} value={form.email} onChange={e=>upd('email',e.target.value)}/>
          </Campo>
          <Campo label="Días de pago">
            <input type="number" style={S.inp} value={form.diaspago} min={0} onChange={e=>upd('diaspago',Number(e.target.value))}/>
          </Campo>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}>
          <button onClick={onClose} style={S.btnCan}>Cancelar</button>
          <button onClick={guardar} disabled={busy} style={S.btnOk}>
            {busy?'Guardando…':<><span style={{fontSize:17}}>💾</span> Guardar proveedor</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({label,children,span}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:3,gridColumn:span?`span ${span}`:undefined}}>
      <span style={{fontSize:10,fontWeight:700,color:'#1a3a6b',textTransform:'uppercase'}}>{label}</span>
      {children}
    </div>
  )
}

const S = {
  fondo:  {position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:400},
  modal:  {background:'#fff',borderRadius:8,padding:20,width:500,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'},
  titulo: {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,fontSize:14,fontWeight:800,color:'#1a3a6b'},
  btnX:   {background:'#e74c3c',color:'#fff',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontWeight:700,fontSize:17},
  err:    {background:'#ffebee',color:'#c62828',border:'1px solid #ef9a9a',borderRadius:4,padding:'5px 10px',marginBottom:10,fontSize:12},
  grid:   {display:'grid',gridTemplateColumns:'1fr 1fr',gap:10},
  inp:    {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none'},
  btnCan: {background:'#888',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
  btnOk:  {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontWeight:700},
}
