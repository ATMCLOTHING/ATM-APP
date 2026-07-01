// src/components/Vendedores.jsx
import { useState, useEffect } from 'react'

const VACIO = { cedvended:'', nomvended:'', celular1:'', celular2:'', empresa:'', usuario:'' }

export default function Vendedores({ supabase, usuario, onClose }) {
  const [lista,    setLista]    = useState([])
  const [busq,     setBusq]     = useState('')
  const [form,     setForm]     = useState(VACIO)
  const [esNuevo,  setEsNuevo]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [msg,      setMsg]      = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('vendedores').select('*').order('nomvended')
    setLista(data || [])
  }

  function nuevo() {
    setForm(VACIO); setEsNuevo(true); setMsg(null)
  }

  function seleccionar(v) {
    setForm({ ...VACIO, ...v }); setEsNuevo(false); setMsg(null)
  }

  function upd(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function guardar() {
    setMsg(null)
    if (!form.cedvended.trim()) return setMsg({ ok:false, txt:'La cédula/código es obligatorio.' })
    if (!form.nomvended.trim()) return setMsg({ ok:false, txt:'El nombre es obligatorio.' })
    setBusy(true)
    const reg = {
      cedvended:  form.cedvended.trim(),
      nomvended:  form.nomvended.trim(),
      celular1:   form.celular1||'',
      celular2:   form.celular2||'',
      empresa:    form.empresa||'',
      usuario:    usuario?.usuario || usuario?.nombre || 'admin',
      fecregistr: new Date().toISOString(),
    }
    const { error } = esNuevo
      ? await supabase.from('vendedores').insert(reg)
      : await supabase.from('vendedores').update(reg).eq('cedvended', form.cedvended)
    setBusy(false)
    if (error) { setMsg({ ok:false, txt: error.message }); return }
    setMsg({ ok:true, txt: esNuevo ? '✅ Vendedor creado.' : '✅ Vendedor actualizado.' })
    await cargar()
    if (esNuevo) setEsNuevo(false)
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar a ${form.nomvended}? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    const { error } = await supabase.from('vendedores').delete().eq('cedvended', form.cedvended)
    setBusy(false)
    if (error) { setMsg({ ok:false, txt: error.message }); return }
    setMsg({ ok:true, txt:'Vendedor eliminado.' })
    setForm(VACIO); setEsNuevo(true)
    await cargar()
  }

  const filtrados = lista.filter(v =>
    v.nomvended?.toLowerCase().includes(busq.toLowerCase()) ||
    v.cedvended?.toString().includes(busq)
  )

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>
          <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:18,color:'#fff',letterSpacing:3}}>ATM</span>
          <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
        </div>
        <span style={S.hTitle}>👤 VENDEDORES</span>
        <button onClick={nuevo}    style={S.hBtn}>➕ Nuevo</button>
        <button onClick={onClose}  style={S.hBtn}>← Menú</button>
      </div>

      <div style={S.body}>
        {/* Lista */}
        <div style={S.lista}>
          <div style={S.lHead}>
            <input style={S.lBusq} placeholder="Buscar por nombre o cédula…"
              value={busq} onChange={e => setBusq(e.target.value)}/>
            <span style={S.lTotal}>{filtrados.length} vendedor{filtrados.length!==1?'es':''}</span>
          </div>
          <div style={S.lTabla}>
            {filtrados.length === 0
              ? <div style={S.lEmpty}>No hay vendedores{busq?' con ese criterio':' registrados'}.</div>
              : filtrados.map(v => (
                <div key={v.cedvended}
                  onClick={() => seleccionar(v)}
                  style={form.cedvended===String(v.cedvended) ? S.lFilaSel : S.lFila}>
                  <span style={S.lNom}>{v.nomvended}</span>
                  <span style={S.lSub}>Cód: {v.cedvended}{v.celular1 ? ` · ${v.celular1}` : ''}{v.empresa ? ` · ${v.empresa}` : ''}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* Formulario */}
        <div style={S.form}>
          <div style={S.fTitulo}>{esNuevo ? '➕ Nuevo Vendedor' : `✏️ Editar — ${form.nomvended}`}</div>

          {msg && <div style={msg.ok ? {...S.msg,...S.msgOk} : {...S.msg,...S.msgErr}}>{msg.txt}</div>}

          <div style={S.fila}>
            <Fld label="Cédula / Código" requerido w={160}>
              <input style={{...S.inp, background: esNuevo?'#fff':'#f5f5f5'}}
                value={form.cedvended} readOnly={!esNuevo}
                onChange={e => upd('cedvended', e.target.value)}
                placeholder="Ej: 13"/>
            </Fld>
            <Fld label="Nombre completo" requerido>
              <input style={S.inp} value={form.nomvended}
                onChange={e => upd('nomvended', e.target.value)}
                placeholder="Nombre del vendedor"/>
            </Fld>
          </div>

          <div style={S.fila}>
            <Fld label="Celular 1" w={180}>
              <input style={S.inp} value={form.celular1}
                onChange={e => upd('celular1', e.target.value)}
                placeholder="3XX XXX XXXX"/>
            </Fld>
            <Fld label="Celular 2" w={180}>
              <input style={S.inp} value={form.celular2}
                onChange={e => upd('celular2', e.target.value)}
                placeholder="Opcional"/>
            </Fld>
            <Fld label="Empresa / Punto de venta">
              <input style={S.inp} value={form.empresa}
                onChange={e => upd('empresa', e.target.value)}
                placeholder="Ej: PUNTO DE VENTA ATM"/>
            </Fld>
          </div>

          <div style={S.btnBar}>
            <button onClick={guardar} disabled={busy} style={{...S.btn,...S.btnSave}}>
              💾 {busy ? 'Guardando…' : 'Guardar'}
            </button>
            {!esNuevo && (
              <button onClick={eliminar} disabled={busy} style={{...S.btn,...S.btnDel}}>
                🗑 Eliminar
              </button>
            )}
            <button onClick={nuevo} style={{...S.btn,...S.btnNew}}>➕ Nuevo</button>
            <button onClick={onClose} style={{...S.btn,...S.btnCx}}>← Menú</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fld({ label, children, requerido, w }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, flex: w ? `0 0 ${w}px` : 1 }}>
      <label style={S.lbl}>{label}{requerido && <span style={{color:'#e53935'}}> *</span>}</label>
      {children}
    </div>
  )
}

const S = {
  wrap:    { position:'fixed',inset:0,background:'#f0f2f5',zIndex:1000,display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif' },
  header:  { background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 16px',display:'flex',alignItems:'center',gap:12,flexShrink:0 },
  logoTxt: { display:'flex',flexDirection:'column',marginRight:8,lineHeight:1.1 },
  hTitle:  { fontSize:15,fontWeight:900,flex:1,letterSpacing:2 },
  hBtn:    { background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:6,padding:'5px 14px',cursor:'pointer',fontSize:12,fontWeight:'bold' },
  body:    { display:'flex',flex:1,overflow:'hidden' },
  lista:   { width:320,background:'#fff',borderRight:'1px solid #ddd',display:'flex',flexDirection:'column',flexShrink:0 },
  lHead:   { padding:'10px 12px',borderBottom:'1px solid #eee',display:'flex',gap:8,alignItems:'center' },
  lBusq:   { flex:1,border:'1px solid #ccc',borderRadius:5,padding:'6px 10px',fontSize:13 },
  lTotal:  { fontSize:11,color:'#666',whiteSpace:'nowrap' },
  lTabla:  { flex:1,overflowY:'auto' },
  lFila:   { padding:'10px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer' },
  lFilaSel:{ padding:'10px 12px',borderBottom:'1px solid #f0f0f0',cursor:'pointer',background:'#e3f2fd' },
  lNom:    { fontSize:13,fontWeight:'bold',color:'#1a3a6b' },
  lSub:    { fontSize:11,color:'#888',marginTop:2 },
  lEmpty:  { padding:40,textAlign:'center',color:'#999',fontSize:13 },
  form:    { flex:1,padding:24,overflowY:'auto',display:'flex',flexDirection:'column',gap:16 },
  fTitulo: { fontSize:15,fontWeight:'bold',color:'#1a3a6b',borderBottom:'2px solid #1a3a6b',paddingBottom:8 },
  fila:    { display:'flex',gap:14,flexWrap:'wrap' },
  lbl:     { fontSize:11,fontWeight:'bold',color:'#555',textTransform:'uppercase' },
  inp:     { border:'1px solid #ccc',borderRadius:5,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box',outline:'none' },
  btnBar:  { display:'flex',gap:8,paddingTop:12,borderTop:'1px solid #eee',marginTop:4 },
  btn:     { display:'flex',alignItems:'center',gap:6,padding:'8px 18px',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:'bold' },
  btnSave: { background:'#1a3a6b',color:'#fff' },
  btnDel:  { background:'#e53935',color:'#fff' },
  btnNew:  { background:'#2e7d32',color:'#fff' },
  btnCx:   { background:'#eee',color:'#333' },
  msg:     { borderRadius:6,padding:'8px 14px',fontSize:13,fontWeight:'bold' },
  msgOk:   { background:'#e8f5e9',color:'#2e7d32',border:'1px solid #a5d6a7' },
  msgErr:  { background:'#fdecea',color:'#c62828',border:'1px solid #ef9a9a' },
}
