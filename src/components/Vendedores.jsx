// src/components/Vendedores.jsx
import { useState, useEffect, useRef } from 'react'
import { LOGO } from '../lib/assets'

const S = {
  wrap:    { position:'fixed',inset:0,background:'#f0f2f5',zIndex:1000,display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif' },
  header:  { background:'#1a1a2e',color:'#fff',padding:'8px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0 },
  hTitle:  { fontSize:16,fontWeight:'bold',flex:1 },
  hBtn:    { background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:6,padding:'5px 14px',cursor:'pointer',fontSize:12,fontWeight:'bold' },
  body:    { display:'flex',flex:1,overflow:'hidden' },
  lista:   { width:360,background:'#fff',borderRight:'1px solid #ddd',display:'flex',flexDirection:'column',flexShrink:0 },
  lHead:   { padding:'10px 12px',borderBottom:'1px solid #eee',display:'flex',gap:8,alignItems:'center' },
  lBusq:   { flex:1,border:'1px solid #ccc',borderRadius:5,padding:'6px 10px',fontSize:13 },
  lTotal:  { fontSize:11,color:'#666',whiteSpace:'nowrap' },
  lTabla:  { flex:1,overflowY:'auto' },
  lFila:   { padding:'8px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',display:'flex',flexDirection:'column',gap:2 },
  lFilaSel:{ padding:'8px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',display:'flex',flexDirection:'column',gap:2,background:'#e8eaf6' },
  lNom:    { fontSize:13,fontWeight:'bold',color:'#1a1a2e' },
  lSub:    { fontSize:11,color:'#666' },
  lEmpty:  { padding:40,textAlign:'center',color:'#999',fontSize:13 },
  form:    { flex:1,padding:20,overflowY:'auto',display:'flex',flexDirection:'column',gap:14 },
  fTitulo: { fontSize:15,fontWeight:'bold',color:'#1a1a2e',borderBottom:'2px solid #1a1a2e',paddingBottom:8,marginBottom:4 },
  fila:    { display:'flex',gap:14 },
  grp:     { display:'flex',flexDirection:'column',gap:4,flex:1 },
  lbl:     { fontSize:11,fontWeight:'bold',color:'#555',textTransform:'uppercase' },
  inp:     { border:'1px solid #ccc',borderRadius:5,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box' },
  req:     { color:'#e53935' },
  btnBar:  { display:'flex',gap:8,paddingTop:8,borderTop:'1px solid #eee',marginTop:8 },
  btn:     { display:'flex',alignItems:'center',gap:6,padding:'7px 16px',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:'bold' },
  btnSave: { background:'#1a1a2e',color:'#fff' },
  btnDel:  { background:'#e53935',color:'#fff' },
  btnNew:  { background:'#2e7d32',color:'#fff' },
  btnCx:   { background:'#eee',color:'#333' },
  msg:     { borderRadius:6,padding:'8px 14px',fontSize:12,fontWeight:'bold' },
  msgOk:   { background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7' },
  msgErr:  { background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a' },
  badge:   { fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:'bold',marginLeft:6 },
  badgeNo: { background:'#fdecea',color:'#c62828' },
  vacio:   { flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'#bbb' },
}

const FORM_VACIO = { cedula:'', nombre:'', celular:'', porcentaje_comision:0, activo:true }

const Fld = ({ label, children, requerido, w }) => (
  <div style={{ ...S.grp, flex: w ? `0 0 ${w}px` : 1 }}>
    <label style={S.lbl}>{label}{requerido && <span style={S.req}> *</span>}</label>
    {children}
  </div>
)

export default function Vendedores({ supabase, onClose, onAyuda }) {
  const [lista,      setLista]      = useState([])
  const [total,      setTotal]      = useState(0)
  const [busqueda,   setBusqueda]   = useState('')
  const [seleccion,  setSeleccion]  = useState(null)
  const [form,       setForm]       = useState(null)
  const [esNuevo,    setEsNuevo]    = useState(false)
  const [guardando,  setGuardando]  = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const busqTimer = useRef(null)

  useEffect(() => { cargar('') }, [])

  async function cargar(q) {
    const query = supabase.from('vendedores')
      .select('id,cedula,nombre,celular,porcentaje_comision,activo', { count:'exact' })
      .order('nombre', { ascending:true })
      .limit(200)
    const { data, count, error } = q.trim()
      ? await query.or(`nombre.ilike.%${q}%,cedula.ilike.%${q}%`)
      : await query
    if (error) console.error('Error cargando vendedores:', error)
    setLista(data || [])
    setTotal(count || 0)
  }

  function onBusqueda(v) {
    setBusqueda(v)
    clearTimeout(busqTimer.current)
    busqTimer.current = setTimeout(() => cargar(v), 350)
  }

  async function seleccionar(v) {
    setSeleccion(v); setConfirmDel(false); setMsg(null)
    const { data } = await supabase.from('vendedores').select('*').eq('id', v.id).single()
    setForm({ ...FORM_VACIO, ...data })
    setEsNuevo(false)
  }

  function nuevo() {
    setSeleccion(null); setConfirmDel(false); setMsg(null)
    setForm({ ...FORM_VACIO }); setEsNuevo(true)
  }

  function cancelar() {
    setForm(null); setSeleccion(null); setEsNuevo(false); setMsg(null); setConfirmDel(false)
  }

  const set = (campo, val) => setForm(f => ({ ...f, [campo]: val }))

  async function guardar() {
    setMsg(null)
    if (!form.nombre.trim()) { setMsg({ ok:false, txt:'El nombre es obligatorio.' }); return }
    setGuardando(true)
    try {
      const payload = {
        cedula:              form.cedula?.trim()  || null,
        nombre:              form.nombre?.trim().toUpperCase() || '',
        celular:             form.celular?.trim() || null,
        porcentaje_comision: Number(form.porcentaje_comision) || 0,
        activo:              form.activo ?? true,
      }
      console.log('Guardando vendedor payload:', payload, 'id:', form.id)
      if (esNuevo) {
        if (form.cedula?.trim()) {
          const { data:existe } = await supabase.from('vendedores').select('id').eq('cedula', form.cedula.trim()).limit(1)
          if (existe?.length > 0) { setMsg({ ok:false, txt:'Ya existe un vendedor con esa cédula.' }); setGuardando(false); return }
        }
        const { data, error } = await supabase.from('vendedores')
          .insert({ ...payload, fecha_registro: new Date().toISOString() })
          .select().single()
        if (error) { console.error('Error insert vendedor:', error); throw error }
        setMsg({ ok:true, txt:'Vendedor creado correctamente.' })
        setEsNuevo(false); setSeleccion(data); setForm({ ...FORM_VACIO, ...data })
      } else {
        const { error } = await supabase.from('vendedores').update(payload).eq('id', form.id)
        if (error) { console.error('Error update vendedor:', error); throw error }
        setMsg({ ok:true, txt:'Vendedor actualizado correctamente.' })
        setSeleccion(prev => ({...prev, ...payload}))
      }
      cargar(busqueda)
    } catch(e) { setMsg({ ok:false, txt:'Error: ' + (e.message || e) }) }
    setGuardando(false)
  }

  async function retirar() {
    if (!confirmDel) { setConfirmDel(true); return }
    setGuardando(true)
    try {
      const { error } = await supabase.from('vendedores').update({ activo:false }).eq('id', form.id)
      if (error) throw error
      setMsg({ ok:true, txt:'Vendedor retirado. Ya no aparecerá en el combo de notas.' })
      setConfirmDel(false); cargar(busqueda); cancelar()
    } catch(e) { setMsg({ ok:false, txt:'Error: ' + (e.message || e) }) }
    setGuardando(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <img src={LOGO} alt="ATM" style={{ height:32 }} />
        <span style={S.hTitle}>GESTIÓN DE VENDEDORES</span>
        <button style={S.hBtn} onClick={nuevo}>+ Nuevo</button>
        {onAyuda && <button onClick={onAyuda} title="Ayuda" style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:14}}>❓</button>}
        <button style={S.hBtn} onClick={onClose}>✕ Cerrar</button>
      </div>

      <div style={S.body}>
        <div style={S.lista}>
          <div style={S.lHead}>
            <input style={S.lBusq} placeholder="Buscar por nombre o cédula…"
              value={busqueda} onChange={e => onBusqueda(e.target.value)} autoFocus />
            <span style={S.lTotal}>{total} vendedor{total !== 1 ? 'es' : ''}</span>
          </div>
          <div style={S.lTabla}>
            {lista.length === 0
              ? <div style={S.lEmpty}>No hay vendedores registrados.</div>
              : lista.map(v => (
                <div key={v.id} style={seleccion?.id === v.id ? S.lFilaSel : S.lFila}
                  onClick={() => seleccionar(v)}>
                  <div style={S.lNom}>
                    {v.nombre}
                    {v.activo === false && <span style={{ ...S.badge, ...S.badgeNo }}>Retirado</span>}
                  </div>
                  <div style={S.lSub}>
                    {v.cedula ? `Céd: ${v.cedula}` : ''}
                    {v.celular ? ` · ${v.celular}` : ''}
                    {v.porcentaje_comision > 0 ? ` · Comisión: ${v.porcentaje_comision}%` : ''}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {form ? (
          <div style={S.form}>
            <div style={S.fTitulo}>
              {esNuevo ? '➕ Nuevo Vendedor' : `✏️ Editar — ${form.nombre}`}
            </div>

            {msg && <div style={{ ...S.msg, ...(msg.ok ? S.msgOk : S.msgErr) }}>{msg.txt}</div>}

            <div style={S.fila}>
              <Fld label="Cédula" w={180}>
                <input style={S.inp} value={form.cedula || ''}
                  onChange={e => set('cedula', e.target.value)} placeholder="Cédula o código" />
              </Fld>
              <Fld label="Estado" w={140}>
                <select style={S.inp} value={form.activo ? 'true' : 'false'}
                  onChange={e => set('activo', e.target.value === 'true')}>
                  <option value="true">Activo</option>
                  <option value="false">Retirado</option>
                </select>
              </Fld>
              <Fld label="% Comisión" w={120}>
                <input style={S.inp} type="number" min={0} max={100}
                  value={form.porcentaje_comision || 0}
                  onChange={e => set('porcentaje_comision', e.target.value)} />
              </Fld>
            </div>

            <Fld label="Nombre completo" requerido>
              <input style={S.inp} value={form.nombre || ''}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre del vendedor" />
            </Fld>

            <Fld label="Celular" w={220}>
              <input style={S.inp} value={form.celular || ''}
                onChange={e => set('celular', e.target.value)}
                placeholder="3XX XXX XXXX" />
            </Fld>

            <div style={S.btnBar}>
              <button style={{ ...S.btn, ...S.btnSave }} onClick={guardar} disabled={guardando}>
                💾 {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {!esNuevo && (
                <button style={{ ...S.btn, ...S.btnDel, background: confirmDel ? '#b71c1c' : '#e53935' }}
                  onClick={retirar} disabled={guardando}>
                  🚪 {confirmDel ? '¿Confirmar retiro?' : 'Retirar'}
                </button>
              )}
              <button style={{ ...S.btn, ...S.btnNew }} onClick={nuevo} disabled={guardando}>
                ➕ Nuevo
              </button>
              <button style={{ ...S.btn, ...S.btnCx }} onClick={cancelar} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div style={S.vacio}>
            <span style={{ fontSize:48 }}>🙋</span>
            <span>Selecciona un vendedor de la lista o crea uno nuevo</span>
            <button style={{ ...S.btn, ...S.btnNew, fontSize:14, padding:'10px 24px' }} onClick={nuevo}>
              ➕ Nuevo Vendedor
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
