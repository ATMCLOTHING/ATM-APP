// src/components/GestionUsuarios.jsx
import { useState, useEffect } from 'react'
import { WZCLOSE, WZNEW, WZSAVE, WZDELETE } from '../lib/assets'

const ROLES = ['admin','cajera','vendedor','bodega']
const MODULOS = ['notas','articulos','cierre','cartera','usuarios']
const MODULO_LABELS = {notas:'Nota de Entrega',articulos:'Artículos/Proveedores',cierre:'Cierre de Caja',cartera:'Cartera',usuarios:'Usuarios'}

const VACIO = {usuario:'',nombre:'',password_hash:'Atm2026*',rol:'cajera',cedula_vendedor:'',activo:true,debe_cambiar_pass:true}

export default function GestionUsuarios({ supabase, onClose }) {
  const [usuarios,   setUsuarios]   = useState([])
  const [seleccion,  setSeleccion]  = useState(null)
  const [form,       setForm]       = useState({...VACIO})
  const [permisos,   setPermisos]   = useState({})
  const [modoNuevo,  setModoNuevo]  = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [vendedores, setVendedores] = useState([])

  useEffect(()=>{ cargarTodo() },[])

  async function cargarTodo() {
    const {data:u} = await supabase.from('usuarios').select('*').order('nombre')
    setUsuarios(u||[])
    const {data:v} = await supabase.from('vendedores').select('cedula,nombre').order('nombre')
    setVendedores(v||[])
  }

  async function seleccionarUsuario(u) {
    setSeleccion(u)
    setForm({...u, password_hash:''})
    setModoNuevo(false)
    const {data:p} = await supabase.from('usuario_permisos').select('*').eq('usuario_id',u.id)
    const map = {}
    MODULOS.forEach(m=>{ map[m]={puede_ver:false,puede_crear:false,puede_editar:false,puede_eliminar:false,puede_anular:false} })
    ;(p||[]).forEach(p=>{ map[p.modulo]=p })
    setPermisos(map)
    setMsg(null)
  }

  function nuevoUsuario() {
    setSeleccion(null); setForm({...VACIO}); setModoNuevo(true)
    const map={}
    MODULOS.forEach(m=>{ map[m]={puede_ver:false,puede_crear:false,puede_editar:false,puede_eliminar:false,puede_anular:false} })
    setPermisos(map); setMsg(null)
  }

  function upd(k,v){setForm(p=>({...p,[k]:v}))}
  function updPerm(mod,accion,val){setPermisos(p=>({...p,[mod]:{...p[mod],[accion]:val}}))}

  async function guardar() {
    if (!form.usuario.trim()||!form.nombre.trim()) { setMsg({tipo:'err',texto:'Usuario y nombre son obligatorios.'}); return }
    if (modoNuevo && !form.password_hash.trim()) { setMsg({tipo:'err',texto:'La contraseña es obligatoria.'}); return }
    setBusy(true)
    try {
      let uid = seleccion?.id
      if (modoNuevo) {
        const {data,error} = await supabase.from('usuarios').insert({
          usuario:form.usuario.toLowerCase().trim(),
          nombre:form.nombre, password_hash:form.password_hash,
          rol:form.rol, cedula_vendedor:form.cedula_vendedor||null,
          activo:form.activo, debe_cambiar_pass:true
        }).select().single()
        if (error) throw error
        uid = data.id
      } else {
        const upObj = {nombre:form.nombre,rol:form.rol,cedula_vendedor:form.cedula_vendedor||null,activo:form.activo}
        if (form.password_hash.trim()) upObj.password_hash = form.password_hash
        const {error} = await supabase.from('usuarios').update(upObj).eq('id',uid)
        if (error) throw error
      }
      // guardar permisos
      await supabase.from('usuario_permisos').delete().eq('usuario_id',uid)
      const permRows = MODULOS.map(m=>({
        usuario_id:uid, modulo:m, ...permisos[m]
      }))
      await supabase.from('usuario_permisos').insert(permRows)
      setMsg({tipo:'ok',texto:`✅ Usuario guardado correctamente.`})
      await cargarTodo()
      setModoNuevo(false)
    } catch(e) { setMsg({tipo:'err',texto:`❌ ${e.message}`}) }
    setBusy(false)
  }

  async function eliminar() {
    if (!seleccion||seleccion.rol==='admin') { setMsg({tipo:'err',texto:'No puedes eliminar al administrador.'}); return }
    if (!window.confirm(`¿Eliminar el usuario "${seleccion.nombre}"?`)) return
    await supabase.from('usuarios').delete().eq('id',seleccion.id)
    setSeleccion(null); setForm({...VACIO}); setModoNuevo(false)
    await cargarTodo()
    setMsg({tipo:'ok',texto:'Usuario eliminado.'})
  }

  async function resetPass() {
    if (!seleccion) return
    await supabase.from('usuarios').update({password_hash:'Atm2026*',debe_cambiar_pass:true}).eq('id',seleccion.id)
    setMsg({tipo:'ok',texto:`Contraseña de ${seleccion.nombre} reiniciada a "Atm2026*"`})
  }

  return (
    <div style={P.pagina}>
      <div style={P.ventana}>
        <div style={P.titulo}>
          <div style={P.logoTxt}>
            <span style={{fontFamily:'Arial Black',fontWeight:900,fontSize:20,color:'#fff',letterSpacing:3}}>ATM</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.8)',letterSpacing:2}}>A TU MEDIDA</span>
          </div>
          <span style={P.titTxt}>GESTIÓN DE USUARIOS</span>
          <button onClick={onClose} style={P.btnCerrar}>← Menú</button>
        </div>

        {msg && (
          <div style={{...P.alerta,background:msg.tipo==='ok'?'#e8f5e9':'#ffebee',color:msg.tipo==='ok'?'#2e7d32':'#c62828',border:`1px solid ${msg.tipo==='ok'?'#a5d6a7':'#ef9a9a'}`}}>
            {msg.texto}<button onClick={()=>setMsg(null)} style={P.alertaX}>✕</button>
          </div>
        )}

        <div style={P.cuerpo}>
          {/* LISTA USUARIOS */}
          <div style={P.lista}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontWeight:700,color:'#1a3a6b',fontSize:13}}>Usuarios ({usuarios.length})</span>
              <button onClick={nuevoUsuario} style={P.btnNuevo}>+ Nuevo</button>
            </div>
            {usuarios.map(u=>(
              <div key={u.id} onClick={()=>seleccionarUsuario(u)}
                style={{...P.listaItem, background:seleccion?.id===u.id?'#dbeafe':'#fff',
                  borderLeft:`4px solid ${u.activo?'#1a3a6b':'#ccc'}`}}>
                <div style={{fontWeight:700,fontSize:13,color:u.activo?'#1a3a6b':'#aaa'}}>{u.nombre}</div>
                <div style={{fontSize:11,color:'#888'}}>{u.usuario} · <span style={{textTransform:'uppercase',fontWeight:600}}>{u.rol}</span></div>
                {!u.activo && <span style={{fontSize:10,color:'#c62828',fontWeight:700}}>INACTIVO</span>}
              </div>
            ))}
          </div>

          {/* FORMULARIO */}
          {(seleccion||modoNuevo) && (
            <div style={P.form}>
              <div style={P.formTit}>{modoNuevo?'Nuevo Usuario':seleccion?.nombre}</div>

              <div style={P.fila}>
                <Campo label="Usuario" w={140}>
                  <input style={P.inp} value={form.usuario} onChange={e=>upd('usuario',e.target.value.toLowerCase())} disabled={!modoNuevo} placeholder="nombre.usuario"/>
                </Campo>
                <Campo label="Nombre completo" w={220}>
                  <input style={P.inp} value={form.nombre} onChange={e=>upd('nombre',e.target.value)} placeholder="Nombre"/>
                </Campo>
                <Campo label="Rol" w={120}>
                  <select style={P.inp} value={form.rol} onChange={e=>upd('rol',e.target.value)}>
                    {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </Campo>
                <Campo label="Activo" w={80}>
                  <select style={P.inp} value={form.activo?'1':'0'} onChange={e=>upd('activo',e.target.value==='1')}>
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </Campo>
              </div>

              {form.rol==='vendedor' && (
                <div style={P.fila}>
                  <Campo label="Vendedor asociado" w={240}>
                    <select style={P.inp} value={form.cedula_vendedor||''} onChange={e=>upd('cedula_vendedor',e.target.value)}>
                      <option value="">-- Selecciona --</option>
                      {vendedores.map(v=><option key={v.cedula} value={v.cedula}>{v.cedula} - {v.nombre}</option>)}
                    </select>
                  </Campo>
                </div>
              )}

              <div style={P.fila}>
                <Campo label={modoNuevo?'Contraseña inicial':'Nueva contraseña (dejar vacío para no cambiar)'} w={320}>
                  <input type="password" style={P.inp} value={form.password_hash}
                    onChange={e=>upd('password_hash',e.target.value)}
                    placeholder={modoNuevo?'Contraseña':'Nueva contraseña (opcional)'}/>
                </Campo>
                {!modoNuevo && (
                  <div style={{alignSelf:'flex-end'}}>
                    <button onClick={resetPass} style={P.btnReset}>🔄 Reset a Atm2026*</button>
                  </div>
                )}
              </div>

              {/* PERMISOS GRANULARES */}
              {form.rol !== 'admin' && (
                <div style={{marginTop:12}}>
                  <div style={{fontWeight:700,color:'#1a3a6b',fontSize:12,marginBottom:8,textTransform:'uppercase'}}>Permisos por módulo</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{background:'#dde3ee'}}>
                        <th style={{padding:'6px 10px',textAlign:'left',fontWeight:700,color:'#1a3a6b'}}>Módulo</th>
                        {['Ver','Crear','Editar','Eliminar','Anular'].map(h=>(
                          <th key={h} style={{padding:'6px 8px',textAlign:'center',fontWeight:700,color:'#1a3a6b'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULOS.map((m,i)=>(
                        <tr key={m} style={{background:i%2===0?'#fff':'#f5f7fc'}}>
                          <td style={{padding:'6px 10px',fontWeight:600}}>{MODULO_LABELS[m]}</td>
                          {['puede_ver','puede_crear','puede_editar','puede_eliminar','puede_anular'].map(a=>(
                            <td key={a} style={{textAlign:'center',padding:'6px'}}>
                              <input type="checkbox" checked={permisos[m]?.[a]||false}
                                onChange={e=>updPerm(m,a,e.target.checked)}/>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {form.rol === 'admin' && (
                <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#2e7d32',marginTop:12}}>
                  ✅ El administrador tiene acceso total a todos los módulos sin restricciones.
                </div>
              )}

              {/* BOTONES */}
              <div style={{display:'flex',gap:8,marginTop:14,justifyContent:'flex-end'}}>
                {!modoNuevo && seleccion?.rol!=='admin' && (
                  <button onClick={eliminar} style={P.btnEliminar}>🗑 Eliminar</button>
                )}
                <button onClick={guardar} disabled={busy} style={P.btnGuardar}>
                  {busy?'Guardando…':'💾 Guardar'}
                </button>
              </div>
            </div>
          )}

          {!seleccion && !modoNuevo && (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#aab8d4',fontSize:14}}>
              Selecciona un usuario o crea uno nuevo
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({label,w,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',width:w,flexShrink:0}}>
      <span style={{fontSize:10,fontWeight:700,color:'#1a3a6b',marginBottom:2,textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      {children}
    </div>
  )
}

const P={
  pagina:    {minHeight:'100vh',background:'#d6dce8',padding:10},
  ventana:   {background:'#eef1f7',borderRadius:8,border:'2px solid #8fa4c8',boxShadow:'0 4px 20px rgba(0,0,0,0.2)',maxWidth:1100,margin:'0 auto',overflow:'hidden'},
  titulo:    {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',color:'#fff',padding:'8px 14px',display:'flex',alignItems:'center'},
  logoTxt:   {display:'flex',flexDirection:'column',marginRight:14,lineHeight:1.1},
  titTxt:    {fontWeight:900,fontSize:15,letterSpacing:2,flex:1,textAlign:'center'},
  btnCerrar: {background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontWeight:700,fontSize:13},
  alerta:    {margin:'5px 10px',padding:'7px 12px',borderRadius:5,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'},
  alertaX:   {background:'none',border:'none',cursor:'pointer',fontWeight:900,fontSize:14},
  cuerpo:    {display:'flex',gap:0,height:'calc(100vh - 80px)'},
  lista:     {width:240,background:'#fff',borderRight:'2px solid #c8d5ea',padding:12,overflowY:'auto',flexShrink:0},
  listaItem: {padding:'8px 10px',borderRadius:6,marginBottom:4,cursor:'pointer',border:'1px solid #e0e7f0'},
  btnNuevo:  {background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'4px 10px',cursor:'pointer',fontWeight:700,fontSize:12},
  form:      {flex:1,padding:16,overflowY:'auto'},
  formTit:   {fontSize:16,fontWeight:900,color:'#1a3a6b',marginBottom:14,paddingBottom:8,borderBottom:'2px solid #c8d5ea'},
  fila:      {display:'flex',flexWrap:'wrap',gap:10,marginBottom:10,alignItems:'flex-end'},
  inp:       {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none',width:'100%',color:'#1a3a6b'},
  btnReset:  {background:'#fff3cd',border:'1px solid #ffc107',borderRadius:5,padding:'5px 10px',cursor:'pointer',fontWeight:600,fontSize:11,color:'#856404'},
  btnEliminar:{background:'#ffebee',border:'1px solid #ef9a9a',color:'#c62828',borderRadius:5,padding:'7px 14px',cursor:'pointer',fontWeight:700},
  btnGuardar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'7px 20px',cursor:'pointer',fontWeight:700,fontSize:13},
}
