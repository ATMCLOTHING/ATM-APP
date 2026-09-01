import { useState, useEffect } from 'react'
import { fetchAll } from '../lib/fetchAll'

const fmt = n => Number(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0})

export default function ModalListadoArticulos({ supabase, onSelect, onClose }) {
  const [articulos, setArticulos] = useState([])
  const [marcas,    setMarcas]    = useState([])
  const [filtMarca, setFiltMarca] = useState('')
  const [filtDesde, setFiltDesde] = useState('')
  const [filtHasta, setFiltHasta] = useState('')
  const [filtDesc,  setFiltDesc]  = useState('')
  const [cargando,  setCargando]  = useState(false)

  useEffect(()=>{
    supabase.from('marcas').select('id,descmarca').order('descmarca')
      .then(({data})=>setMarcas(data||[]))
    buscar()
  },[])

  async function buscar() {
    setCargando(true)
    // articulo ya tiene más de 1000 filas — sin paginar, un listado sin filtrar (o con filtros
    // amplios) quedaba cortado. Se arma como fábrica porque fetchAll pagina llamándola varias veces.
    const buildQuery = () => {
      let q = supabase.from('articulo')
        .select('codartic,descartic,tipo,genero,marca,nomproveed,preciocomp,preciovent,preciovend,preciovenv,existencia,existminim,estado')
        .order('codartic',{ascending:true})
      if (filtMarca)        q = q.eq('marca', filtMarca)
      if (filtDesde.trim()) q = q.gte('codartic', filtDesde.trim())
      if (filtHasta.trim()) q = q.lte('codartic', filtHasta.trim())
      if (filtDesc.trim())  q = q.ilike('descartic', `%${filtDesc.trim()}%`)
      return q
    }
    const data = await fetchAll(buildQuery)
    setArticulos(data||[])
    setCargando(false)
  }

  function imprimir() {
    const w = window.open('','_blank','width=900,height=600')
    w.document.write(`
      <html><head><meta charset="UTF-8"><title>Listado de Artículos</title>
      <style>
        @page{size:letter landscape;margin:10mm;}
        body{font-family:Arial,sans-serif;font-size:11px;padding:20px;}
        h2{color:#1a3a6b;margin-bottom:4px;}
        .filtros{font-size:10px;color:#888;margin-bottom:10px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#1a3a6b;color:#fff;padding:5px 6px;text-align:left;font-size:10px;}
        td{padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;}
        tr:nth-child(even){background:#f5f7fc;}
        .neg{color:#c62828;font-weight:700;}
        @media print{body{padding:8px;}}
      </style></head><body>
      <h2>ATM — LISTADO DE ARTÍCULOS</h2>
      <div class="filtros">
        ${filtMarca?`Marca: ${filtMarca} | `:''}
        ${filtDesde?`Desde: ${filtDesde} | `:''}
        ${filtHasta?`Hasta: ${filtHasta} | `:''}
        ${filtDesc?`Descripción: ${filtDesc} | `:''}
        Total: ${articulos.length} artículos
      </div>
      <table>
        <thead><tr>
          <th>Código</th><th>Descripción</th><th>Tipo</th><th>Género</th><th>Marca</th>
          <th>$ Compra</th><th>$ Mayor</th><th>$ Detal</th><th>$ Vendedor</th>
          <th>Exist.</th><th>Mín.</th><th>Estado</th>
        </tr></thead>
        <tbody>
          ${articulos.map(a=>`
            <tr>
              <td><b>${a.codartic}</b></td>
              <td>${a.descartic}</td>
              <td>${a.tipo||''}</td>
              <td>${a.genero||''}</td>
              <td>${a.marca||''}</td>
              <td style="text-align:right">$${fmt(a.preciocomp)}</td>
              <td style="text-align:right">$${fmt(a.preciovent)}</td>
              <td style="text-align:right">$${fmt(a.preciovend)}</td>
              <td style="text-align:right">$${fmt(a.preciovenv)}</td>
              <td style="text-align:center" class="${a.existencia<=a.existminim?'neg':''}">${a.existencia}</td>
              <td style="text-align:center">${a.existminim}</td>
              <td style="text-align:center">${a.estado==='A'?'Activo':'Inactivo'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </body></html>
    `)
    w.document.close(); w.focus()
    setTimeout(()=>{w.print();w.close()},400)
  }

  return (
    <div style={S.fondo}>
      <div style={S.modal}>
        <div style={S.titulo}>
          <span><span style={{fontSize:20}}>📦</span> LISTADO DE ARTÍCULOS</span>
          <button onClick={onClose} style={S.btnX}>✕</button>
        </div>

        {/* FILTROS */}
        <div style={S.filtros}>
          <label style={S.lbl}>Marca
            <select style={S.inp} value={filtMarca} onChange={e=>setFiltMarca(e.target.value)}>
              <option value="">Todas</option>
              {marcas.map(m=><option key={m.id} value={m.descmarca}>{m.descmarca}</option>)}
            </select>
          </label>
          <label style={S.lbl}>Descripción
            <input style={S.inp} value={filtDesc} onChange={e=>setFiltDesc(e.target.value)}
              placeholder="Buscar en descripción…" onKeyDown={e=>e.key==='Enter'&&buscar()}/>
          </label>
          <label style={S.lbl}>Código desde
            <input style={S.inp} value={filtDesde} onChange={e=>setFiltDesde(e.target.value)} placeholder="Ej: 10"/>
          </label>
          <label style={S.lbl}>Código hasta
            <input style={S.inp} value={filtHasta} onChange={e=>setFiltHasta(e.target.value)} placeholder="Ej: 500"/>
          </label>
          <button onClick={buscar} disabled={cargando} style={S.btnBuscar}>
            {cargando?<span style={{fontSize:17}}>⏳</span>:<><span style={{fontSize:17}}>🔍</span> Buscar</>}
          </button>
          <button onClick={imprimir} disabled={!articulos.length} style={S.btnImpr}>
            <span style={{fontSize:17}}>🖨</span> Imprimir
          </button>
        </div>

        {/* TABLA */}
        <div style={S.tablaWrap}>
          <div style={{fontSize:11,color:'#888',marginBottom:4}}>{articulos.length} artículo(s) encontrado(s)</div>
          <table style={S.tabla}>
            <thead>
              <tr style={S.thead}>
                {['Código','Descripción','Tipo','Género','Marca','$ Mayor','$ Detal','Exist.','Mín.','Estado'].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {articulos.length===0&&!cargando&&(
                <tr><td colSpan={10} style={{textAlign:'center',padding:20,color:'#888'}}>No hay artículos con esos filtros.</td></tr>
              )}
              {articulos.map((a,i)=>(
                <tr key={a.codartic}
                  onClick={()=>{ if(onSelect){ onSelect(a.codartic); onClose() } }}
                  style={{background:i%2===0?'#fff':'#f5f7fc',fontSize:12,cursor:onSelect?'pointer':'default'}}
                  title={onSelect?`Abrir artículo ${a.codartic}`:undefined}>
                  <td style={{...S.td,fontWeight:700,color:'#1a3a6b'}}>{a.codartic}</td>
                  <td style={S.td}>{a.descartic}</td>
                  <td style={S.td}>{a.tipo||''}</td>
                  <td style={S.td}>{a.genero||''}</td>
                  <td style={S.td}>{a.marca||''}</td>
                  <td style={{...S.td,textAlign:'right'}}>${fmt(a.preciovent)}</td>
                  <td style={{...S.td,textAlign:'right'}}>${fmt(a.preciovend)}</td>
                  <td style={{...S.td,textAlign:'center',fontWeight:700,color:a.existencia<=a.existminim?'#c62828':'#1a3a6b'}}>{a.existencia}</td>
                  <td style={{...S.td,textAlign:'center'}}>{a.existminim}</td>
                  <td style={{...S.td,textAlign:'center',color:a.estado==='A'?'#2e7d32':'#c62828',fontWeight:600}}>{a.estado==='A'?'Activo':'Inactivo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{textAlign:'right',marginTop:10}}>
          <button onClick={onClose} style={S.btnCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  fondo:    {position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300},
  modal:    {background:'#fff',borderRadius:10,padding:20,width:900,maxHeight:'92vh',display:'flex',flexDirection:'column',gap:10,boxShadow:'0 12px 40px rgba(0,0,0,0.3)'},
  titulo:   {display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:15,fontWeight:900,color:'#1a3a6b'},
  btnX:     {background:'#e74c3c',color:'#fff',border:'none',borderRadius:5,padding:'3px 10px',cursor:'pointer',fontWeight:900,fontSize:20},
  filtros:  {display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',background:'#f0f4ff',border:'1px solid #c8d5ea',borderRadius:6,padding:10},
  lbl:      {display:'flex',flexDirection:'column',gap:3,fontSize:11,fontWeight:700,color:'#1a3a6b',flex:1,minWidth:130},
  inp:      {height:28,border:'1px solid #c8d5ea',borderRadius:4,padding:'0 8px',fontSize:12,outline:'none'},
  btnBuscar:{background:'#1a3a6b',color:'#fff',border:'none',borderRadius:5,padding:'0 16px',cursor:'pointer',fontWeight:700,height:32,alignSelf:'flex-end'},
  btnImpr:  {background:'#2e7d32',color:'#fff',border:'none',borderRadius:5,padding:'0 16px',cursor:'pointer',fontWeight:700,height:32,alignSelf:'flex-end'},
  tablaWrap:{overflowY:'auto',flex:1,maxHeight:440},
  tabla:    {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:    {background:'#1a3a6b',position:'sticky',top:0},
  th:       {padding:'6px 8px',color:'#fff',fontWeight:700,textAlign:'left',fontSize:11,whiteSpace:'nowrap'},
  td:       {padding:'5px 8px',borderBottom:'1px solid #eee'},
  btnCerrar:{background:'#888',color:'#fff',border:'none',borderRadius:5,padding:'7px 18px',cursor:'pointer',fontWeight:700},
}
