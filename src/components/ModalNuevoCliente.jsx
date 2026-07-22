// src/components/ModalNuevoCliente.jsx
// Popup para crear un cliente nuevo desde Nota de Entrega
// Se abre cuando se ingresa una cédula que no existe en la BD

import { useState } from 'react'

const S = {
  fondo:  { position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center' },
  modal:  { background:'#fff',borderRadius:10,width:520,boxShadow:'0 8px 32px rgba(0,0,0,0.25)',fontFamily:'Arial,sans-serif',overflow:'hidden' },
  titulo: { background:'#1a1a2e',color:'#fff',padding:'12px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:15,fontWeight:'bold' },
  btnX:   { background:'none',border:'none',color:'#fff',fontSize:26,cursor:'pointer',lineHeight:1 },
  body:   { padding:20,display:'flex',flexDirection:'column',gap:12 },
  fila:   { display:'flex',gap:12 },
  grp:    { display:'flex',flexDirection:'column',gap:4,flex:1 },
  lbl:    { fontSize:11,fontWeight:'bold',color:'#555',textTransform:'uppercase' },
  inp:    { border:'1px solid #ccc',borderRadius:5,padding:'7px 10px',fontSize:13,width:'100%',boxSizing:'border-box' },
  inpRO:  { background:'#f5f5f5',border:'1px solid #ddd',borderRadius:5,padding:'7px 10px',fontSize:13,width:'100%',boxSizing:'border-box' },
  req:    { color:'#e53935' },
  pie:    { padding:'12px 20px',borderTop:'1px solid #eee',display:'flex',justifyContent:'flex-end',gap:10 },
  btnOk:  { background:'#1a1a2e',color:'#fff',border:'none',borderRadius:6,padding:'9px 24px',fontSize:13,fontWeight:'bold',cursor:'pointer' },
  btnCx:  { background:'#eee',color:'#333',border:'none',borderRadius:6,padding:'9px 24px',fontSize:13,cursor:'pointer' },
  alerta: { background:'#fff3cd',border:'1px solid #ffc107',borderRadius:5,padding:'8px 12px',fontSize:12,color:'#856404' },
  error:  { background:'#fdecea',border:'1px solid #e53935',borderRadius:5,padding:'8px 12px',fontSize:12,color:'#c62828' },
}

const Fld = ({ label, children, requerido }) => (
  <div style={S.grp}>
    <label style={S.lbl}>{label} {requerido && <span style={S.req}>*</span>}</label>
    {children}
  </div>
)

export default function ModalNuevoCliente({ supabase, cedulaInicial = '', onGuardado, onClose }) {
  const [form, setForm] = useState({
    cedula:      cedulaInicial,
    nombre:      '',
    telefono:    '',
    celular:     '',
    ciudad:      '',
    direccion:   '',
    nom_empresa: '',
    email:       '',
    forma_pago:  'CONTADO',
    tipo:        'J',
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState(null)

  const set = (campo, val) => setForm(f => ({ ...f, [campo]: val }))

  async function guardar() {
    setError(null)
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }

    setGuardando(true)
    try {
      // Verificar que la cédula no exista ya
      if (form.cedula.trim()) {
        const { data: existe } = await supabase.from('clientes')
          .select('id').eq('cedula', form.cedula.trim()).limit(1)
        if (existe && existe.length > 0) {
          setError('Ya existe un cliente con esa cédula/NIT.')
          setGuardando(false)
          return
        }
      }

      const { data, error: err } = await supabase.from('clientes').insert({
        cedula:           form.cedula.trim()      || null,
        nombre:           form.nombre.trim().toUpperCase(),
        telefono:         form.telefono.trim()    || null,
        celular:          form.celular.trim()      || null,
        ciudad:           form.ciudad.trim().toUpperCase() || null,
        direccion:        form.direccion.trim()   || null,
        nom_empresa:      form.nom_empresa.trim() || null,
        email:            form.email.trim()        || null,
        forma_pago:       form.forma_pago,
        tipo:             form.tipo,
        activo:           true,
        fecha_registro:   new Date().toISOString(),
        usuario_registro: 'APP',
      }).select().single()

      if (err) throw err
      onGuardado(data)   // devuelve el cliente recién creado a NotaDeEntrega
    } catch (e) {
      setError('Error al guardar: ' + (e.message || e))
    }
    setGuardando(false)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span><span style={{fontSize:20}}>👤</span> CLIENTE NUEVO</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        <div style={S.body}>
          <div style={S.alerta}>
            La cédula <strong>{cedulaInicial}</strong> no existe. Completa los datos para registrar el cliente.
          </div>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.fila}>
            <Fld label="Cédula / NIT">
              <input style={S.inp} value={form.cedula}
                onChange={e => set('cedula', e.target.value)} placeholder="Cédula o NIT" />
            </Fld>
            <Fld label="Tipo">
              <select style={S.inp} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="J">Jurídico</option>
                <option value="N">Natural</option>
              </select>
            </Fld>
          </div>

          <Fld label="Nombre / Razón Social" requerido>
            <input style={S.inp} value={form.nombre} autoFocus
              onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre completo o razón social"
              onKeyDown={e => e.key === 'Enter' && guardar()} />
          </Fld>

          <Fld label="Empresa">
            <input style={S.inp} value={form.nom_empresa}
              onChange={e => set('nom_empresa', e.target.value)} placeholder="Nombre de la empresa (opcional)" />
          </Fld>

          <div style={S.fila}>
            <Fld label="Teléfono">
              <input style={S.inp} value={form.telefono}
                onChange={e => set('telefono', e.target.value)} placeholder="Teléfono fijo" />
            </Fld>
            <Fld label="Celular">
              <input style={S.inp} value={form.celular}
                onChange={e => set('celular', e.target.value)} placeholder="Celular" />
            </Fld>
          </div>

          <div style={S.fila}>
            <Fld label="Ciudad">
              <input style={S.inp} value={form.ciudad}
                onChange={e => set('ciudad', e.target.value)} placeholder="Ciudad" />
            </Fld>
            <Fld label="Forma de pago">
              <select style={S.inp} value={form.forma_pago} onChange={e => set('forma_pago', e.target.value)}>
                {['CONTADO','15 DÍAS','30 DÍAS','45 DÍAS','60 DÍAS','90 DÍAS'].map(p =>
                  <option key={p} value={p}>{p}</option>)}
              </select>
            </Fld>
          </div>

          <Fld label="Dirección">
            <input style={S.inp} value={form.direccion}
              onChange={e => set('direccion', e.target.value)} placeholder="Dirección" />
          </Fld>

          <Fld label="Email">
            <input style={S.inp} value={form.email} type="email"
              onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
          </Fld>
        </div>

        <div style={S.pie}>
          <button onClick={onClose} style={S.btnCx} disabled={guardando}>Cancelar</button>
          <button onClick={guardar} style={S.btnOk} disabled={guardando}>
            {guardando ? 'Guardando…' : <><span style={{fontSize:17}}>✔</span> Guardar Cliente</>}
          </button>
        </div>
      </div>
    </div>
  )
}
