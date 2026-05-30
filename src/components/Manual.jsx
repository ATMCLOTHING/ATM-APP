// src/components/Manual.jsx
// Manual de usuario ATM-APP — accesible desde el Dashboard

import { useState } from 'react'

const SECCIONES = [
  {
    id: 'inicio',
    icon: '🚀',
    titulo: 'Inicio y Login',
    contenido: [
      {
        subtitulo: 'Cómo ingresar al sistema',
        texto: `Abre el navegador y ve a https://atm-app-alpha.vercel.app. Ingresa tu usuario y contraseña. La contraseña inicial es Atm2026* — el sistema te pedirá cambiarla en el primer ingreso.`
      },
      {
        subtitulo: 'Roles del sistema',
        tabla: {
          headers: ['Usuario', 'Rol', 'Acceso'],
          filas: [
            ['admin', 'Administrador', 'Todo el sistema'],
            ['caja1 / caja2 / caja3', 'Cajera', 'Notas de entrega y abonos'],
            ['laura', 'Vendedor', 'Sus notas y su cartera'],
            ['prendas', 'Bodega', 'Artículos y proveedores'],
          ]
        }
      },
      {
        subtitulo: 'Cerrar sesión',
        texto: 'Haz clic en el botón ⏻ en la esquina superior derecha del Dashboard.'
      }
    ]
  },
  {
    id: 'nota',
    icon: '📋',
    titulo: 'Nota de Entrega',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Es el documento principal de venta. Registra qué se vendió, a quién, cuánto costó y cómo se pagó.'
      },
      {
        subtitulo: 'Crear una nota nueva',
        pasos: [
          'Haz clic en el botón ➕ Nueva (o presiona el ícono de hoja nueva en la barra inferior)',
          'Ingresa la cédula del cliente y presiona Enter — si existe, carga sus datos automáticamente',
          'Si el cliente no existe, el sistema abre un formulario para registrarlo',
          'Selecciona el vendedor en el combo correspondiente',
          'Elige el tipo de precio: Mayor, Detal o Vendedor',
          'En la tabla de artículos, ingresa el código o descripción — el sistema busca automáticamente',
          'Ajusta cantidades según sea necesario',
          'Selecciona la forma de pago (Contado / Crédito) y el medio (Efectivo / Transferencia / Mixto)',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Navegar entre notas',
        tabla: {
          headers: ['Botón', 'Acción'],
          filas: [
            ['⏮', 'Primera nota'],
            ['◀', 'Nota anterior'],
            ['▶', 'Nota siguiente'],
            ['⏭', 'Última nota'],
            ['🔍', 'Buscar nota por número, cédula, nombre o fecha'],
          ]
        }
      },
      {
        subtitulo: 'Buscar una nota',
        pasos: [
          'Haz clic en el ícono 🔍 de la barra de navegación',
          'Puedes buscar por número de nota, cédula, nombre del cliente o rango de fechas',
          'Filtra por estado: Todas, Pendientes, Pagadas o Anuladas',
          'Haz doble clic en la nota o selecciónala y clic en "Abrir nota"'
        ]
      },
      {
        subtitulo: 'Registrar abonos',
        pasos: [
          'Abre la nota a la que quieres abonar',
          'Haz clic en el botón 💵 Abonos (esquina inferior derecha)',
          'Ingresa el valor del abono y el medio de pago',
          'Confirma — el saldo se actualiza automáticamente'
        ]
      },
      {
        subtitulo: 'Anular una nota',
        pasos: [
          'Solo el administrador puede anular notas',
          'Abre la nota y haz clic en el ícono 🗑️ Anular',
          'Ingresa el motivo de anulación',
          'La nota queda marcada como ANULADA y el inventario se restaura automáticamente'
        ]
      },
      {
        subtitulo: 'Imprimir una nota',
        texto: 'Haz clic en el ícono 🖨️ Imprimir. Puedes elegir entre formato ticket (80mm) o media carta.'
      }
    ]
  },
  {
    id: 'clientes',
    icon: '👤',
    titulo: 'Clientes',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer?',
        texto: 'Ver el listado completo de clientes, crear nuevos, editar datos y desactivar clientes.'
      },
      {
        subtitulo: 'Crear un cliente',
        pasos: [
          'Haz clic en el botón "+ Nuevo"',
          'Completa los campos: cédula, nombre, teléfono, celular, ciudad, dirección y empresa',
          'El nombre es el único campo obligatorio',
          'Haz clic en "Guardar"'
        ]
      },
      {
        subtitulo: 'Buscar un cliente',
        texto: 'Usa la barra de búsqueda superior — busca por nombre, cédula o empresa. Los resultados aparecen en tiempo real.'
      },
      {
        subtitulo: 'Cliente nuevo desde Nota de Entrega',
        texto: 'Si en la Nota de Entrega ingresas una cédula que no existe y presionas Enter, el sistema abre automáticamente el formulario de nuevo cliente con la cédula ya ingresada.'
      }
    ]
  },
  {
    id: 'articulos',
    icon: '📦',
    titulo: 'Artículos',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer?',
        texto: 'Ver, crear y editar artículos del inventario. Cada artículo tiene un registro maestro y uno por talla con su existencia.'
      },
      {
        subtitulo: 'Buscar un artículo',
        texto: 'Usa la barra de búsqueda por código o descripción. Puedes filtrar por marca, género y estado.'
      },
      {
        subtitulo: 'Precios',
        tabla: {
          headers: ['Tipo', 'Campo', 'Usado para'],
          filas: [
            ['Mayor', 'preciovent', 'Venta por mayor (precio por defecto)'],
            ['Detal', 'preciovend', 'Venta al detal'],
            ['Vendedor', 'preciovenv', 'Precio especial para vendedores'],
          ]
        }
      },
      {
        subtitulo: 'Inventario',
        texto: 'El inventario se descuenta automáticamente al guardar una nota de entrega y se restaura al anularla. Nunca modifiques el inventario manualmente a menos que sea necesario.'
      }
    ]
  },
  {
    id: 'cartera',
    icon: '📊',
    titulo: 'Cartera',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Muestra todas las notas con saldo pendiente. Permite ver la cartera por vendedor, filtrar por estado y mora, y registrar abonos a múltiples notas a la vez.'
      },
      {
        subtitulo: 'Generar la cartera',
        pasos: [
          'Selecciona el vendedor (o deja en blanco para ver todos)',
          'Elige el estado: Pendientes, Pagadas o Todas',
          'Opcionalmente filtra por mora mínima (30, 60 o 90 días)',
          'Haz clic en 🔍 Generar'
        ]
      },
      {
        subtitulo: 'Registrar abonos desde Cartera',
        pasos: [
          'Haz clic en "💵 Registrar abono"',
          'Ve a la pestaña "Detalle por Nota" y marca las notas con ✓',
          'Ingresa el valor total del abono',
          'Haz clic en "⚡ Distribuir" — el sistema reparte el valor en orden cronológico',
          'Revisa la distribución propuesta y haz clic en "💾 Confirmar y guardar"'
        ]
      },
      {
        subtitulo: 'Imprimir',
        texto: 'Usa los botones 🖨 Resumen y 🖨 Detalle para generar listados imprimibles de la cartera.'
      }
    ]
  },
  {
    id: 'cierre',
    icon: '💰',
    titulo: 'Cierre de Caja',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Genera informes de ventas por período. Permite ver consolidados por vendedor, ventas por marca, por cliente, resumen del día, top artículos y cartera pendiente.'
      },
      {
        subtitulo: 'Generar un informe',
        pasos: [
          'Selecciona el rango de fechas (Desde / Hasta)',
          'Haz clic en 🔍 Generar Informes',
          'Navega entre las pestañas para ver cada informe'
        ]
      },
      {
        subtitulo: 'Pestañas disponibles',
        tabla: {
          headers: ['Pestaña', 'Contenido'],
          filas: [
            ['📊 Consolidado por Vendedor', 'Ventas por vendedor: efectivo, transferencia, mixto, crédito'],
            ['🏷️ Ventas por Marca', 'Unidades y valor vendido por marca'],
            ['👥 Ventas por Cliente', 'Detalle de ventas por cliente'],
            ['💰 Resumen del Día', 'Totales: ventas, ingresos, por cajera, cartera'],
            ['🏆 Top Artículos', 'Los 10 artículos más vendidos'],
            ['📋 Cartera Pendiente', 'Notas con saldo por cobrar'],
          ]
        }
      },
      {
        subtitulo: 'Ventas por cajera',
        texto: 'El sistema identifica automáticamente quién hizo cada nota según el usuario registrado: Cajera 1 (caja1), Cajera 2 (caja2), Cajera 3 (caja3) o Vendedor/Admin.'
      }
    ]
  },
  {
    id: 'comisiones',
    icon: '💼',
    titulo: 'Comisiones',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Módulo para liquidar las comisiones de los vendedores sobre sus ventas pagadas. Solo aplica a notas registradas por Admin o vendedores — no por cajeras.'
      },
      {
        subtitulo: 'Configurar porcentajes',
        pasos: [
          'Ve a la pestaña ⚙️ Porcentajes',
          'Haz clic en "✏️ Editar porcentajes"',
          'Ingresa el % de cada vendedor',
          'Haz clic en "💾 Guardar"'
        ]
      },
      {
        subtitulo: 'Liquidar comisiones',
        pasos: [
          'Ve a la pestaña 💵 Liquidar Comisión',
          'Selecciona el vendedor',
          'Opcionalmente filtra por rango de fechas',
          'Haz clic en "🔍 Buscar notas" — muestra todas las notas pagadas no liquidadas',
          'Selecciona las notas a incluir (vienen todas marcadas por defecto)',
          'El sistema calcula automáticamente el valor de la comisión',
          'Haz clic en "💾 Liquidar" y confirma',
          'Las notas quedan marcadas como liquidadas y no vuelven a aparecer'
        ]
      },
      {
        subtitulo: 'Historial',
        texto: 'En la pestaña 📋 Historial puedes ver todas las liquidaciones registradas con fecha, vendedor, monto y porcentaje aplicado.'
      }
    ]
  },
  {
    id: 'usuarios',
    icon: '👥',
    titulo: 'Usuarios',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer?',
        texto: 'Solo el administrador puede gestionar usuarios. Permite crear, editar y desactivar usuarios del sistema.'
      },
      {
        subtitulo: 'Crear un usuario',
        pasos: [
          'Ve al módulo Usuarios desde el Dashboard',
          'Haz clic en "+ Nuevo"',
          'Ingresa usuario, nombre, contraseña y rol',
          'Guarda — el usuario puede ingresar inmediatamente'
        ]
      },
      {
        subtitulo: 'Roles disponibles',
        tabla: {
          headers: ['Rol', 'Descripción'],
          filas: [
            ['admin', 'Acceso total al sistema'],
            ['cajera', 'Solo Notas de Entrega y abonos'],
            ['vendedor', 'Sus notas y su cartera'],
            ['bodega', 'Artículos y proveedores'],
          ]
        }
      },
      {
        subtitulo: 'Cambiar contraseña',
        texto: 'Cada usuario puede cambiar su propia contraseña en el primer ingreso. El administrador puede resetearla desde el módulo de Usuarios.'
      }
    ]
  },
]

export default function Manual({ onClose }) {
  const [secActiva, setSecActiva] = useState('inicio')
  const seccion = SECCIONES.find(s => s.id === secActiva)

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <span style={S.headerTit}>❓ MANUAL DE USUARIO — ATM-APP</span>
        <button onClick={onClose} style={S.btnClose}>✕ Cerrar</button>
      </div>

      <div style={S.body}>
        {/* SIDEBAR */}
        <div style={S.sidebar}>
          <div style={S.sidebarTit}>MÓDULOS</div>
          {SECCIONES.map(s => (
            <button key={s.id} onClick={() => setSecActiva(s.id)}
              style={{...S.sideItem, ...(secActiva === s.id ? S.sideItemActivo : {})}}>
              <span style={{fontSize:18}}>{s.icon}</span>
              <span>{s.titulo}</span>
            </button>
          ))}
        </div>

        {/* CONTENIDO */}
        <div style={S.contenido}>
          <div style={S.secTitulo}>
            <span style={{fontSize:28}}>{seccion.icon}</span>
            <span>{seccion.titulo}</span>
          </div>

          {seccion.contenido.map((bloque, i) => (
            <div key={i} style={S.bloque}>
              <div style={S.subTitulo}>{bloque.subtitulo}</div>

              {bloque.texto && (
                <p style={S.texto}>{bloque.texto}</p>
              )}

              {bloque.pasos && (
                <ol style={S.lista}>
                  {bloque.pasos.map((p, j) => (
                    <li key={j} style={S.item}>{p}</li>
                  ))}
                </ol>
              )}

              {bloque.tabla && (
                <table style={S.tabla}>
                  <thead>
                    <tr style={S.thead}>
                      {bloque.tabla.headers.map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bloque.tabla.filas.map((fila, j) => (
                      <tr key={j} style={{background: j%2===0?'#fff':'#f5f7ff'}}>
                        {fila.map((cel, k) => (
                          <td key={k} style={S.td}>{cel}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap:         {position:'fixed',inset:0,background:'#f0f2f5',zIndex:2000,display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif'},
  header:       {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  headerTit:    {color:'#fff',fontWeight:900,fontSize:16,letterSpacing:1},
  btnClose:     {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'6px 16px',cursor:'pointer',fontSize:13,fontWeight:700},
  body:         {display:'flex',flex:1,overflow:'hidden'},
  sidebar:      {width:220,background:'#1a3a6b',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'},
  sidebarTit:   {color:'rgba(255,255,255,0.5)',fontSize:10,fontWeight:700,padding:'16px 16px 8px',textTransform:'uppercase',letterSpacing:1},
  sideItem:     {display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'none',border:'none',color:'rgba(255,255,255,0.8)',cursor:'pointer',fontSize:13,textAlign:'left',width:'100%',borderLeft:'3px solid transparent'},
  sideItemActivo:{background:'rgba(255,255,255,0.15)',color:'#fff',borderLeft:'3px solid #ffc107',fontWeight:700},
  contenido:    {flex:1,overflowY:'auto',padding:28},
  secTitulo:    {display:'flex',alignItems:'center',gap:12,fontSize:22,fontWeight:900,color:'#1a3a6b',marginBottom:20,paddingBottom:12,borderBottom:'3px solid #1a3a6b'},
  bloque:       {background:'#fff',borderRadius:8,padding:18,marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'},
  subTitulo:    {fontSize:13,fontWeight:800,color:'#1a3a6b',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5},
  texto:        {fontSize:13,color:'#444',lineHeight:1.7},
  lista:        {paddingLeft:20,margin:0},
  item:         {fontSize:13,color:'#444',lineHeight:1.8,marginBottom:4},
  tabla:        {width:'100%',borderCollapse:'collapse',fontSize:13,marginTop:8},
  thead:        {background:'#1a3a6b'},
  th:           {padding:'8px 12px',color:'#fff',fontWeight:700,textAlign:'left'},
  td:           {padding:'7px 12px',borderBottom:'1px solid #eee',color:'#444'},
}
