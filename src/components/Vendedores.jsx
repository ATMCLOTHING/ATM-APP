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
  selBar:  { padding:'8px 12px',borderBottom:'1px solid #eee',display:'flex',flexDirection:'column',gap:6,background:'#fafafa',flexShrink:0 },
  selRow:  { display:'flex',gap:6,alignItems:'center' },
  selLbl:  { fontSize:10,fontWeight:'bold',color:'#555' },
  selInp:  { width:64,border:'1px solid #ccc',borderRadius:4,padding:'4px 6px',fontSize:11 },
  selBtn:  { background:'#1a1a2e',color:'#fff',border:'none',borderRadius:4,padding:'4px 10px',fontSize:11,cursor:'pointer',fontWeight:'bold' },
  selBtnSec:{ background:'#eee',color:'#333',border:'none',borderRadius:4,padding:'4px 10px',fontSize:11,cursor:'pointer',fontWeight:'bold' },
  selInfo: { fontSize:11,color:'#666',marginLeft:'auto' },
  lFilaRow:{ display:'flex',alignItems:'flex-start',gap:8,padding:'8px 12px',borderBottom:'1px solid #f0f0f0' },
  lFilaRowSel:{ display:'flex',alignItems:'flex-start',gap:8,padding:'8px 12px',borderBottom:'1px solid #f0f0f0',background:'#e8eaf6' },
  lChk:    { marginTop:3,cursor:'pointer',flexShrink:0 },
  lContenido:{ flex:1,display:'flex',flexDirection:'column',gap:2,cursor:'pointer',minWidth:0 },
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
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [cedDesde,   setCedDesde]   = useState('')
  const [cedHasta,   setCedHasta]   = useState('')
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
    setSeleccionados(new Set((data || []).map(v => v.id)))
  }

  // Cédula es texto pero se compara/ordena como número cuando es posible (evita que "9" quede después de "10")
  const numCed = c => { const n = Number((c || '').trim()); return c && Number.isFinite(n) ? n : null }

  function ordenarPorCedula(arr) {
    return [...arr].sort((a, b) => {
      const na = numCed(a.cedula), nb = numCed(b.cedula)
      if (na === null && nb === null) return 0
      if (na === null) return 1
      if (nb === null) return -1
      return na - nb
    })
  }

  function toggleSel(id) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selAll()  { setSeleccionados(new Set(lista.map(v => v.id))) }
  function selNone() { setSeleccionados(new Set()) }

  function seleccionarRango() {
    const dTxt = cedDesde.trim(), hTxt = cedHasta.trim()
    if (!dTxt && !hTxt) return
    const d = numCed(dTxt), h = numCed(hTxt)
    const enRango = lista.filter(v => {
      const n = numCed(v.cedula)
      if (n === null) return false
      if (d !== null && n < d) return false
      if (h !== null && n > h) return false
      return true
    })
    setSeleccionados(new Set(enRango.map(v => v.id)))
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

  function imprimirListado() {
    const seleccionadosList = ordenarPorCedula(lista.filter(v => seleccionados.has(v.id)))
    if (!seleccionadosList.length) return
    const w = window.open('', '_blank', 'width=900,height=700')
    const fecha = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
    w.document.write(`
      <html><head><meta charset="UTF-8"><title>Listado de Vendedores</title>
      <style>
        @page{size:letter portrait;margin:12mm;}
        body{font-family:Arial,sans-serif;font-size:11px;padding:16px;color:#222;}
        h2{color:#1a1a2e;margin:0 0 2px;}
        .sub{font-size:10px;color:#888;margin-bottom:10px;}
        table{width:100%;border-collapse:collapse;table-layout:fixed;}
        th{background:#1a1a2e;color:#fff;padding:6px 8px;text-align:left;font-size:10px;}
        td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;word-wrap:break-word;}
        tr:nth-child(even){background:#f5f5fa;}
        .ret{color:#c62828;font-weight:700;}
        @media print{body{padding:6px;}}
      </style></head><body>
      <h2>ATM CLOTHING — LISTADO DE VENDEDORES</h2>
      <div class="sub">${busqueda.trim() ? `Filtro: "${busqueda.trim()}" | ` : ''}Fecha: ${fecha} | Seleccionados: ${seleccionadosList.length} de ${lista.length} | Orden: cédula</div>
      <table>
        <colgroup><col style="width:16%"><col style="width:38%"><col style="width:18%"><col style="width:14%"><col style="width:14%"></colgroup>
        <thead><tr><th>Cédula</th><th>Nombre</th><th>Celular</th><th>% Comisión</th><th>Estado</th></tr></thead>
        <tbody>
          ${seleccionadosList.map(v => `
            <tr>
              <td>${v.cedula || ''}</td>
              <td>${v.nombre}</td>
              <td>${v.celular || ''}</td>
              <td style="text-align:center">${v.porcentaje_comision || 0}%</td>
              <td style="text-align:center" class="${v.activo === false ? 'ret' : ''}">${v.activo === false ? 'Retirado' : 'Activo'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      </body></html>
    `)
    w.document.close(); w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
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
        <img src={LOGO} alt="ATM" style={{ height:42 }} />
        <span style={S.hTitle}>GESTIÓN DE VENDEDORES</span>
        <button style={S.hBtn} onClick={nuevo}>+ Nuevo</button>
        <button style={S.hBtn} onClick={imprimirListado} disabled={!seleccionados.size} title="Imprimir listado de los vendedores seleccionados">🖨 Listado ({seleccionados.size})</button>
        {onAyuda && <button onClick={onAyuda} title="Ayuda" style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:'50%',width:36,height:36,cursor:'pointer',fontSize:18}}>❓</button>}
        <button style={S.hBtn} onClick={onClose}><span style={{fontSize:16}}>✕</span> Cerrar</button>
      </div>

      <div style={S.body}>
        <div style={S.lista}>
          <div style={S.lHead}>
            <input style={S.lBusq} placeholder="Buscar por nombre o cédula…"
              value={busqueda} onChange={e => onBusqueda(e.target.value)} autoFocus />
            <span style={S.lTotal}>{total} vendedor{total !== 1 ? 'es' : ''}</span>
          </div>

          <div style={S.selBar}>
            <div style={S.selRow}>
              <span style={S.selLbl}>Rango cédula:</span>
              <input style={S.selInp} placeholder="Desde" value={cedDesde} onChange={e => setCedDesde(e.target.value)} />
              <span style={{ fontSize:11, color:'#999' }}>—</span>
              <input style={S.selInp} placeholder="Hasta" value={cedHasta} onChange={e => setCedHasta(e.target.value)} />
              <button style={S.selBtn} onClick={seleccionarRango}>Aplicar</button>
            </div>
            <div style={S.selRow}>
              <button style={S.selBtnSec} onClick={selAll}>Todos</button>
              <button style={S.selBtnSec} onClick={selNone}>Ninguno</button>
              <span style={S.selInfo}>{seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div style={S.lTabla}>
            {lista.length === 0
              ? <div style={S.lEmpty}>No hay vendedores registrados.</div>
              : lista.map(v => (
                <div key={v.id} style={seleccion?.id === v.id ? S.lFilaRowSel : S.lFilaRow}>
                  <input type="checkbox" style={S.lChk}
                    checked={seleccionados.has(v.id)}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleSel(v.id)} />
                  <div style={S.lContenido} onClick={() => seleccionar(v)}>
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
                </div>
              ))
            }
          </div>
        </div>

        {form ? (
          <div style={S.form}>
            <div style={S.fTitulo}>
              {esNuevo ? <><span style={{fontSize:20}}>➕</span> Nuevo Vendedor</> : <><span style={{fontSize:20}}>✏️</span> Editar — {form.nombre}</>}
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
                <span style={{fontSize:16}}>💾</span> {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {!esNuevo && (
                <button style={{ ...S.btn, ...S.btnDel, background: confirmDel ? '#b71c1c' : '#e53935' }}
                  onClick={retirar} disabled={guardando}>
                  <span style={{fontSize:16}}>🚪</span> {confirmDel ? '¿Confirmar retiro?' : 'Retirar'}
                </button>
              )}
              <button style={{ ...S.btn, ...S.btnNew }} onClick={nuevo} disabled={guardando}>
                <span style={{fontSize:16}}>➕</span> Nuevo
              </button>
              <button style={{ ...S.btn, ...S.btnCx }} onClick={cancelar} disabled={guardando}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div style={S.vacio}>
            <span style={{ fontSize:62 }}>🙋</span>
            <span>Selecciona un vendedor de la lista o crea uno nuevo</span>
            <button style={{ ...S.btn, ...S.btnNew, fontSize:14, padding:'10px 24px' }} onClick={nuevo}>
              <span style={{fontSize:18}}>➕</span> Nuevo Vendedor
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
