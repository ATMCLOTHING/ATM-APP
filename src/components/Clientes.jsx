// src/components/Clientes.jsx
// Módulo completo de gestión de clientes — listado, crear, editar, eliminar

import { useState, useEffect, useRef } from 'react'
import { LOGO, WZNEW, WZSAVE, WZDELETE, WZCLOSE, WZLOCATE, WZPRINT } from '../lib/assets'

const fmt = d => d ? new Date(d).toLocaleDateString('es-CO') : ''

const S = {
  wrap:    { position:'fixed',inset:0,background:'#f0f2f5',zIndex:1000,display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif' },
  header:  { background:'#1a1a2e',color:'#fff',padding:'8px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0 },
  hTitle:  { fontSize:16,fontWeight:'bold',flex:1 },
  hBtn:    { background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',borderRadius:6,padding:'5px 14px',cursor:'pointer',fontSize:12,fontWeight:'bold' },
  body:    { display:'flex',flex:1,overflow:'hidden',gap:0 },

  // Panel izquierdo — listado
  lista:   { width:460,background:'#fff',borderRight:'1px solid #ddd',display:'flex',flexDirection:'column',flexShrink:0 },
  lHead:   { padding:'10px 12px',borderBottom:'1px solid #eee',display:'flex',gap:8,alignItems:'center' },
  lBusq:   { flex:1,border:'1px solid #ccc',borderRadius:5,padding:'6px 10px',fontSize:13 },
  lTotal:  { fontSize:11,color:'#666',whiteSpace:'nowrap' },
  lTabla:  { flex:1,overflowY:'auto' },
  lFila:   { padding:'8px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',display:'flex',flexDirection:'column',gap:2 },
  lFilaSel:{ padding:'8px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',display:'flex',flexDirection:'column',gap:2,background:'#e8eaf6' },
  lNom:    { fontSize:13,fontWeight:'bold',color:'#1a1a2e' },
  lSub:    { fontSize:11,color:'#666' },
  lEmpty:  { padding:40,textAlign:'center',color:'#999',fontSize:13 },

  // Panel derecho — formulario
  form:    { flex:1,padding:20,overflowY:'auto',display:'flex',flexDirection:'column',gap:14 },
  fTitulo: { fontSize:15,fontWeight:'bold',color:'#1a1a2e',borderBottom:'2px solid #1a1a2e',paddingBottom:8,marginBottom:4 },
  fila:    { display:'flex',gap:14 },
  grp:     { display:'flex',flexDirection:'column',gap:4,flex:1 },
  lbl:     { fontSize:11,fontWeight:'bold',color:'#555',textTransform:'uppercase' },
  inp:     { border:'1px solid #ccc',borderRadius:5,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box' },
  inpRO:   { border:'1px solid #eee',borderRadius:5,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box',background:'#f9f9f9',color:'#555' },
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
  badge:   { fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:'bold' },
  badgeOk: { background:'#e8f5e9',color:'#2e7d32' },
  badgeNo: { background:'#fdecea',color:'#c62828' },
  vacio:   { flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:'#bbb' },
}

const FORM_VACIO = {
  cedula:'', nombre:'', telefono:'', celular:'', email:'',
  ciudad:'', departamento:'', direccion:'', nom_empresa:'',
  forma_pago:'CONTADO', tipo:'J', activo:true,
}

const Fld = ({ label, children, requerido, w }) => (
  <div style={{ ...S.grp, flex: w ? `0 0 ${w}px` : 1 }}>
    <label style={S.lbl}>{label}{requerido && <span style={S.req}> *</span>}</label>
    {children}
  </div>
)

export default function Clientes({ supabase, onClose }) {
  const [clientes,   setClientes]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [busqueda,   setBusqueda]   = useState('')
  const [seleccion,  setSeleccion]  = useState(null)   // cliente seleccionado del listado
  const [form,       setForm]       = useState(null)   // null = sin formulario abierto
  const [esNuevo,    setEsNuevo]    = useState(false)
  const [guardando,  setGuardando]  = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const busqTimer = useRef(null)

  useEffect(() => { cargar('') }, [])

  async function cargar(q) {
    const query = supabase.from('clientes')
      .select('id,cedula,nombre,celular,telefono,ciudad,nom_empresa,activo,forma_pago,fecha_registro', { count: 'exact' })
      .order('nombre', { ascending: true })
      .limit(200)

    const { data, count } = q.trim()
      ? await query.or(`nombre.ilike.%${q}%,cedula.ilike.%${q}%,nom_empresa.ilike.%${q}%`)
      : await query

    setClientes(data || [])
    setTotal(count || 0)
  }

  function onBusqueda(v) {
    setBusqueda(v)
    clearTimeout(busqTimer.current)
    busqTimer.current = setTimeout(() => cargar(v), 350)
  }

  async function seleccionar(cli) {
    setSeleccion(cli)
    setConfirmDel(false)
    setMsg(null)
    // cargar datos completos
    const { data } = await supabase.from('clientes').select('*').eq('id', cli.id).single()
    setForm({ ...FORM_VACIO, ...data })
    setEsNuevo(false)
  }

  function nuevo() {
    setSeleccion(null)
    setConfirmDel(false)
    setMsg(null)
    setForm({ ...FORM_VACIO })
    setEsNuevo(true)
  }

  function cancelar() {
    setForm(null)
    setSeleccion(null)
    setEsNuevo(false)
    setMsg(null)
    setConfirmDel(false)
  }

  const set = (campo, val) => setForm(f => ({ ...f, [campo]: val }))

  async function guardar() {
    setMsg(null)
    if (!form.nombre.trim()) { setMsg({ ok: false, txt: 'El nombre es obligatorio.' }); return }

    setGuardando(true)
    try {
      const payload = {
        cedula:           form.cedula.trim()      || null,
        nombre:           form.nombre.trim().toUpperCase(),
        telefono:         form.telefono.trim()    || null,
        celular:          form.celular.trim()      || null,
        email:            form.email.trim()        || null,
        ciudad:           form.ciudad.trim().toUpperCase() || null,
        departamento:     form.departamento.trim() || null,
        direccion:        form.direccion.trim()   || null,
        nom_empresa:      form.nom_empresa.trim() || null,
        forma_pago:       form.forma_pago,
        tipo:             form.tipo,
        activo:           form.activo,
      }

      if (esNuevo) {
        // verificar cédula duplicada
        if (form.cedula.trim()) {
          const { data: existe } = await supabase.from('clientes')
            .select('id').eq('cedula', form.cedula.trim()).limit(1)
          if (existe && existe.length > 0) {
            setMsg({ ok: false, txt: 'Ya existe un cliente con esa cédula/NIT.' })
            setGuardando(false)
            return
          }
        }
        const { data, error } = await supabase.from('clientes')
          .insert({ ...payload, fecha_registro: new Date().toISOString(), usuario_registro: 'ADMIN' })
          .select().single()
        if (error) throw error
        setMsg({ ok: true, txt: 'Cliente creado correctamente.' })
        setEsNuevo(false)
        setSeleccion(data)
        setForm({ ...FORM_VACIO, ...data })
      } else {
        const { error } = await supabase.from('clientes').update(payload).eq('id', form.id)
        if (error) throw error
        setMsg({ ok: true, txt: 'Cliente actualizado correctamente.' })
      }
      cargar(busqueda)
    } catch (e) {
      setMsg({ ok: false, txt: 'Error: ' + (e.message || e) })
    }
    setGuardando(false)
  }

  async function eliminar() {
    if (!confirmDel) { setConfirmDel(true); return }
    setGuardando(true)
    try {
      // Eliminación lógica — solo marca activo = false
      const { error } = await supabase.from('clientes')
        .update({ activo: false }).eq('id', form.id)
      if (error) throw error
      setMsg({ ok: true, txt: 'Cliente desactivado.' })
      setConfirmDel(false)
      cargar(busqueda)
      cancelar()
    } catch (e) {
      setMsg({ ok: false, txt: 'Error: ' + (e.message || e) })
    }
    setGuardando(false)
  }

  return (
    <div style={S.wrap}>
      {/* ── HEADER ── */}
      <div style={S.header}>
        <img src={LOGO} alt="ATM" style={{ height: 32 }} />
        <span style={S.hTitle}>GESTIÓN DE CLIENTES</span>
        <button style={S.hBtn} onClick={nuevo}>+ Nuevo</button>
        <button style={S.hBtn} onClick={onClose}>✕ Cerrar</button>
      </div>

      <div style={S.body}>
        {/* ── LISTA ── */}
        <div style={S.lista}>
          <div style={S.lHead}>
            <input
              style={S.lBusq}
              placeholder="Buscar por nombre, cédula o empresa…"
              value={busqueda}
              onChange={e => onBusqueda(e.target.value)}
              autoFocus
            />
            <span style={S.lTotal}>{total.toLocaleString()} clientes</span>
          </div>
          <div style={S.lTabla}>
            {clientes.length === 0
              ? <div style={S.lEmpty}>No hay resultados</div>
              : clientes.map(c => (
                <div
                  key={c.id}
                  style={seleccion?.id === c.id ? S.lFilaSel : S.lFila}
                  onClick={() => seleccionar(c)}
                >
                  <div style={S.lNom}>
                    {c.nombre}
                    {!c.activo && <span style={{ ...S.badge, ...S.badgeNo, marginLeft: 6 }}>Inactivo</span>}
                  </div>
                  <div style={S.lSub}>
                    {c.cedula && <span>{c.cedula} · </span>}
                    {c.celular || c.telefono || ''}
                    {c.ciudad && <span> · {c.ciudad}</span>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* ── FORMULARIO ── */}
        {form ? (
          <div style={S.form}>
            <div style={S.fTitulo}>
              {esNuevo ? '➕ Nuevo Cliente' : `✏️ Editar Cliente — ${form.nombre}`}
            </div>

            {msg && (
              <div style={{ ...S.msg, ...(msg.ok ? S.msgOk : S.msgErr) }}>{msg.txt}</div>
            )}

            <div style={S.fila}>
              <Fld label="Cédula / NIT" w={160}>
                <input style={S.inp} value={form.cedula || ''}
                  onChange={e => set('cedula', e.target.value)} placeholder="Cédula o NIT" />
              </Fld>
              <Fld label="Tipo" w={110}>
                <select style={S.inp} value={form.tipo || 'J'} onChange={e => set('tipo', e.target.value)}>
                  <option value="J">Jurídico</option>
                  <option value="N">Natural</option>
                </select>
              </Fld>
              <Fld label="Estado" w={110}>
                <select style={S.inp} value={form.activo ? 'true' : 'false'}
                  onChange={e => set('activo', e.target.value === 'true')}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </Fld>
            </div>

            <Fld label="Nombre / Razón Social" requerido>
              <input style={S.inp} value={form.nombre || ''}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre completo o razón social" />
            </Fld>

            <Fld label="Empresa">
              <input style={S.inp} value={form.nom_empresa || ''}
                onChange={e => set('nom_empresa', e.target.value)} placeholder="Nombre de la empresa" />
            </Fld>

            <div style={S.fila}>
              <Fld label="Teléfono">
                <input style={S.inp} value={form.telefono || ''}
                  onChange={e => set('telefono', e.target.value)} placeholder="Teléfono fijo" />
              </Fld>
              <Fld label="Celular">
                <input style={S.inp} value={form.celular || ''}
                  onChange={e => set('celular', e.target.value)} placeholder="Celular" />
              </Fld>
              <Fld label="Email">
                <input style={S.inp} value={form.email || ''}
                  onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" type="email" />
              </Fld>
            </div>

            <div style={S.fila}>
              <Fld label="Ciudad">
                <input style={S.inp} value={form.ciudad || ''}
                  onChange={e => set('ciudad', e.target.value)} placeholder="Ciudad" />
              </Fld>
              <Fld label="Departamento">
                <input style={S.inp} value={form.departamento || ''}
                  onChange={e => set('departamento', e.target.value)} placeholder="Departamento" />
              </Fld>
              <Fld label="Forma de pago" w={140}>
                <select style={S.inp} value={form.forma_pago || 'CONTADO'}
                  onChange={e => set('forma_pago', e.target.value)}>
                  {['CONTADO','15 DÍAS','30 DÍAS','45 DÍAS','60 DÍAS','90 DÍAS'].map(p =>
                    <option key={p} value={p}>{p}</option>)}
                </select>
              </Fld>
            </div>

            <Fld label="Dirección">
              <input style={S.inp} value={form.direccion || ''}
                onChange={e => set('direccion', e.target.value)} placeholder="Dirección completa" />
            </Fld>

            {/* ── BOTONES ── */}
            <div style={S.btnBar}>
              <button style={{ ...S.btn, ...S.btnSave }} onClick={guardar} disabled={guardando}>
                💾 {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {!esNuevo && (
                <button
                  style={{ ...S.btn, ...S.btnDel, background: confirmDel ? '#b71c1c' : '#e53935' }}
                  onClick={eliminar} disabled={guardando}
                >
                  🗑️ {confirmDel ? '¿Confirmar?' : 'Desactivar'}
                </button>
              )}
              <button style={{ ...S.btn, ...S.btnNew }} onClick={nuevo} disabled={guardando}>
                ➕ Nuevo
              </button>
              <button style={{ ...S.btn, ...S.btnCx }} onClick={cancelar} disabled={guardando}>
                Cancelar
              </button>
              {!esNuevo && form.fecha_registro && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999', alignSelf: 'center' }}>
                  Registro: {fmt(form.fecha_registro)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={S.vacio}>
            <span style={{ fontSize: 48 }}>👤</span>
            <span>Selecciona un cliente de la lista o crea uno nuevo</span>
            <button style={{ ...S.btn, ...S.btnNew, fontSize: 14, padding: '10px 24px' }} onClick={nuevo}>
              ➕ Nuevo Cliente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
