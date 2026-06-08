// src/components/Manual.jsx
import { useState } from 'react'

const SECCIONES = [
  {
    id: 'inicio',
    icon: '🚀',
    titulo: 'Inicio y Login',
    contenido: [
      {
        subtitulo: 'Cómo ingresar al sistema',
        texto: 'Abre el navegador y ve a https://atm-app-alpha.vercel.app. Ingresa tu usuario y contraseña. La contraseña inicial es Atm2026* — el sistema te pedirá cambiarla en el primer ingreso.'
      },
      {
        subtitulo: 'Roles del sistema',
        tabla: {
          headers: ['Usuario', 'Rol', 'Acceso'],
          filas: [
            ['admin', 'Administrador', 'Todo el sistema'],
            ['caja1 / caja2 / caja3', 'Cajera', 'Notas de entrega y abonos'],
            ['laura (u otro)', 'Vendedor', 'Sus notas y su cartera'],
            ['prendas', 'Bodega', 'Artículos y proveedores'],
            ['PIN', 'Especial', 'PIN de autorización para acciones restringidas — solo el admin lo conoce'],
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
        texto: 'Es el documento principal de venta. Registra qué se vendió, a quién, cuánto costó y cómo se pagó. Hay dos series: notas de Vendedor (números menores a 1.000.000) y notas de Caja (desde 1.000.000 en adelante).'
      },
      {
        subtitulo: 'Crear una nota nueva',
        pasos: [
          'Haz clic en el botón ➕ Nueva',
          'Si eres admin, elige la serie antes de crear: Caja (≥1.000.000) o Vendedor (<1.000.000)',
          'Ingresa la cédula del cliente y presiona Enter — si existe, carga sus datos automáticamente',
          'Si el cliente no existe, el sistema abre un formulario para registrarlo',
          'Selecciona el vendedor — es obligatorio para poder guardar',
          'Elige el tipo de precio: Mayor, Detal o Vendedor',
          'En la tabla de artículos, ingresa el código y presiona Enter',
          'Ajusta cantidades según sea necesario',
          'Selecciona el plazo de pago — la fecha de vencimiento se calcula automáticamente',
          'Selecciona el medio de pago (Efectivo / Transferencia / Mixto / Crédito)',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Ingreso con pistola de código de barras',
        pasos: [
          'Apunta la pistola al código de barras del artículo y dispara',
          'El sistema extrae automáticamente el código del artículo (elimina ceros a la izquierda)',
          'Si el artículo ya está en la nota, suma 1 a la cantidad existente',
          'Si es nuevo, agrega una línea y el cursor baja listo para el siguiente escaneo',
          'Si el código tiene varias tallas, aparece un dropdown para elegir la correcta'
        ]
      },
      {
        subtitulo: 'Ingreso manual de artículos',
        pasos: [
          'Escribe el código en el campo correspondiente',
          'Presiona Enter para buscar — si no existe muestra un mensaje de error',
          'Si hay varias coincidencias, aparece un dropdown para seleccionar',
          'Al elegir del dropdown, el cursor va al campo cantidad para que la edites'
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
        subtitulo: 'Registrar abonos',
        pasos: [
          'Abre la nota a la que quieres abonar',
          'Haz clic en el botón 💵 Abonos',
          'Ingresa el valor del abono, la fecha y el medio de pago',
          'Haz clic en 💾 Registrar abono — el saldo se actualiza automáticamente'
        ]
      },
      {
        subtitulo: 'Revertir un abono',
        pasos: [
          'Abre la nota y entra al módulo de Abonos',
          'En el historial de abonos, haz clic en ↩ Revertir junto al abono que deseas eliminar',
          'El sistema pedirá el PIN de administrador',
          'Ingresa el PIN y confirma — el abono se elimina y el saldo se recalcula'
        ]
      },
      {
        subtitulo: 'Desbloquear una nota para edición',
        pasos: [
          'Una nota guardada está bloqueada por defecto para evitar cambios accidentales',
          'Haz clic en el botón 🔓 (amarillo) en la barra de botones',
          'Ingresa el PIN de administrador',
          'La nota muestra el badge 🔓 EDITANDO — todos los campos quedan habilitados',
          'Realiza los cambios necesarios y haz clic en 💾 Guardar',
          'Para cancelar sin guardar, haz clic en 🔒 para volver al estado original'
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
        texto: 'El inventario se descuenta automáticamente al guardar una nota de entrega y se restaura al anularla. Nunca modifiques el inventario manualmente a menos que sea estrictamente necesario.'
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
        texto: 'Muestra todas las notas con saldo pendiente. Permite ver la cartera por vendedor, filtrar por estado y mora, y registrar abonos a múltiples notas.'
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
    id: 'documentos',
    icon: '📋',
    titulo: 'Control de Documentos',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Permite rastrear la ubicación física del documento de cada Nota de Entrega de vendedor. Solo el administrador puede ver y cambiar los estados. Aplica únicamente a notas de la serie vendedor (número menor a 1.000.000).'
      },
      {
        subtitulo: 'Estados del documento',
        tabla: {
          headers: ['Estado', 'Ícono', 'Significado'],
          filas: [
            ['Almacén',           '🏪', 'El documento está en ATM, en proceso de despacho'],
            ['Vendedor',          '🤝', 'El documento está en manos del vendedor'],
            ['Cuentas por Cobrar','📂', 'El documento está en la carpeta de CxC'],
            ['Liquidada',         '✅', 'La comisión del vendedor fue pagada sobre esta nota'],
            ['Eliminada',         '🗑', 'El administrador decidió eliminar el documento'],
          ]
        }
      },
      {
        subtitulo: 'Cambiar el estado de un documento',
        pasos: [
          'Entra al módulo Control de Documentos desde el Dashboard',
          'Usa los filtros por vendedor o estado para encontrar la nota',
          'En la columna "Cambiar a", haz clic en el ícono del estado al que quieres mover el documento',
          'El cambio se guarda inmediatamente — no requiere confirmación',
        ]
      },
      {
        subtitulo: 'Filtros y resumen',
        texto: 'La parte superior muestra 5 tarjetas con el conteo y saldo total por estado. Haz clic en cualquier tarjeta para filtrar la tabla por ese estado. También puedes filtrar por vendedor o buscar por número de nota, cliente o cédula.'
      }
    ]
  },
  {
    id: 'egresos',
    icon: '💸',
    titulo: 'Egresos / Pago de Cuentas',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Módulo para registrar todos los pagos y gastos de la empresa. Organizado en grupos y tipos de egreso. Solo el administrador puede registrar y consultar egresos.'
      },
      {
        subtitulo: 'Grupos de egresos',
        texto: 'Cada egreso pertenece a un grupo (ej: Transporte, Nómina, Impuestos) y dentro del grupo a un tipo específico (ej: Gasolina, Seguridad Social, IVA). Al seleccionar el grupo, solo aparecen los tipos de ese grupo.'
      },
      {
        subtitulo: 'Registrar un egreso',
        pasos: [
          'Haz clic en el ícono ➕ Nueva',
          'Selecciona el Grupo de Egreso',
          'Selecciona el Tipo de Egreso (se filtra según el grupo)',
          'Busca el beneficiario por cédula (Enter) o escribe el nombre para buscar en terceros',
          'Completa el sub-detalle, período desde/hasta y documento del beneficiario',
          'Ingresa el Subtotal — el Total se calcula automáticamente sumando recargos y restando descuentos',
          'Selecciona el medio de pago — si es Transferencia, Consignación o Cheque aparecen los campos de Banco y Cuenta',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Campos del formulario',
        tabla: {
          headers: ['Campo', 'Descripción'],
          filas: [
            ['Doc Interno',    'Consecutivo automático — no se puede modificar'],
            ['Sub-Detalle',    'Descripción adicional del gasto (ej: "Arepas", "Marzo 2026")'],
            ['Per. Desde/Hasta','Período al que corresponde el gasto'],
            ['Docto. Benef.',  'Número de factura o documento del beneficiario'],
            ['$ Recargos',     'Valor adicional al subtotal'],
            ['$ Descuento',    'Valor a descontar del subtotal'],
            ['# Aprobación',   'Código o número de autorización del pago'],
          ]
        }
      },
      {
        subtitulo: 'Buscar un egreso',
        pasos: [
          'Haz clic en el ícono 🔍 Buscar en la barra de navegación',
          'Busca por número de documento o nombre del beneficiario',
          'Haz clic en la fila para cargar el egreso'
        ]
      },
      {
        subtitulo: 'Anular un egreso',
        texto: 'Haz clic en el ícono 🗑 Anular e ingresa el motivo. El egreso queda marcado como ANULADO pero nunca se borra de la base de datos.'
      },
      {
        subtitulo: 'Terceros / Beneficiarios',
        texto: 'La base de terceros incluye los proveedores y contactos de ATM. Si el beneficiario no está en la lista, puedes escribir el nombre manualmente sin necesidad de crearlo.'
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
            ['🏷️ Ventas por Marca',         'Unidades y valor vendido por marca'],
            ['👥 Ventas por Cliente',        'Detalle de ventas por cliente'],
            ['💰 Resumen del Día',           'Totales: ventas mostrador, ventas vendedor, abonos, cartera'],
            ['🏆 Top Artículos',             'Los 10 artículos más vendidos'],
            ['📋 Cartera Pendiente',         'Notas con saldo por cobrar'],
          ]
        }
      },
      {
        subtitulo: 'Dashboard — Resumen del día',
        tabla: {
          headers: ['Tarjeta', 'Qué muestra'],
          filas: [
            ['Ventas Mostrador', 'Suma de notas de caja del día (≥1.000.000)'],
            ['Ventas Vendedor',  'Suma de notas de vendedor del día (<1.000.000)'],
            ['Prendas vendidas', 'Total de unidades vendidas en el día'],
            ['Abonos Vendedor',  'Abonos recibidos sobre notas de crédito del día'],
            ['Cartera pendiente','Saldo total por cobrar (todas las fechas)'],
          ]
        }
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
        texto: 'Módulo para consultar y gestionar las cuentas por cobrar. Permite ver el estado de las notas de crédito, registrar abonos y generar el informe de cartera vigente por vendedor.'
      },
      {
        subtitulo: 'Filtros disponibles',
        tabla: {
          headers: ['Filtro', 'Opciones'],
          filas: [
            ['Vendedor', 'Filtra por vendedor asignado a las notas'],
            ['Cliente', 'Escribe el nombre o cédula — filtra en tiempo real'],
            ['Estado', 'Pendientes / Pagadas / Todas'],
            ['Mora mínima', 'Todas / +30 días / +60 días / +90 días'],
          ]
        }
      },
      {
        subtitulo: 'Vistas disponibles',
        tabla: {
          headers: ['Vista', 'Qué muestra'],
          filas: [
            ['Resumen por Cliente', 'Total notas, valor, abonado y saldo por cliente. Haz clic en un cliente para ver sus notas'],
            ['Detalle por Nota', 'Cada nota con fecha, vencimiento y días de mora'],
          ]
        }
      },
      {
        subtitulo: 'Colores de mora',
        tabla: {
          headers: ['Color', 'Significado'],
          filas: [
            ['🟢 Verde', 'Sin mora — pago vigente'],
            ['🟡 Amarillo', 'Más de 30 días de mora'],
            ['🟠 Naranja', 'Más de 60 días de mora'],
            ['🔴 Rojo', 'Más de 90 días de mora'],
          ]
        }
      },
      {
        subtitulo: 'Registrar un abono desde Cartera',
        pasos: [
          'Genera la cartera con los filtros que necesitas',
          'Haz clic en el botón 💵 Registrar Abono',
          'Selecciona una o varias notas marcando las casillas',
          'Ingresa el valor total del abono y el medio de pago',
          'Haz clic en ⚡ Distribuir — el sistema reparte el valor cronológicamente',
          'Revisa la distribución propuesta y haz clic en 💾 Confirmar y guardar'
        ]
      },
      {
        subtitulo: 'Informe Cartera Completa',
        texto: 'Haz clic en el botón 📄 Cartera Completa para generar un informe imprimible agrupado por vendedor y cliente, igual al reporte de cartera vigente del sistema anterior. Muestra # documento, fecha, vencimiento, mora, valor, abono y saldo de cada nota.'
      }
    ]
  },
  {
    id: 'egresos',
    icon: '💸',
    titulo: 'Egresos',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Módulo para registrar y controlar todos los gastos de la empresa: nómina, arriendos, impuestos, servicios, comisiones y más. Solo el administrador tiene acceso.'
      },
      {
        subtitulo: 'Registrar un egreso',
        pasos: [
          'Selecciona el Tipo de Egreso (Nómina, Arriendos, Impuestos, etc.)',
          'Escribe el Subdetalle si aplica — descripción adicional del gasto',
          'Ingresa la fecha de inicio del Período — la fecha final se calcula automáticamente al final del mes',
          'Selecciona la Fecha de Pago y el Medio de Pago (Efectivo o Transferencia)',
          'Busca el Beneficiario escribiendo su nombre o cédula en el campo de búsqueda',
          'Si el beneficiario no está en la lista, escribe el nombre directamente',
          'Ingresa el Valor Neto y el recargo o descuento si aplican',
          'Haz clic en 💾 Guardar Egreso'
        ]
      },
      {
        subtitulo: 'Consultar egresos',
        pasos: [
          'Ve a la pestaña 🔍 Consultar / Imprimir',
          'Selecciona el rango de fechas y filtra por tipo o medio de pago si necesitas',
          'Haz clic en 🔍 Consultar',
          'Para imprimir el reporte haz clic en 🖨 Imprimir'
        ]
      },
      {
        subtitulo: 'Resumen por Categoría',
        texto: 'La pestaña 📊 Resumen muestra tarjetas visuales con el total gastado en cada categoría durante el período seleccionado, con el porcentaje que representa del total.'
      },
      {
        subtitulo: 'Gestionar Tipos de Egreso',
        pasos: [
          'Haz clic en el botón ⚙️ Gestionar Tipos de Egreso en la parte superior',
          'Para agregar: escribe el nombre y haz clic en ➕ Agregar',
          'Para eliminar: haz clic en la × junto al tipo que deseas borrar'
        ]
      },
      {
        subtitulo: 'Gestionar Terceros (Beneficiarios)',
        pasos: [
          'Haz clic en el botón 👥 Gestionar Terceros en la parte superior',
          'Para agregar: completa cédula, nombre, ciudad y teléfono, luego haz clic en ➕ Agregar',
          'Para editar: haz clic en ✏️ junto al tercero que deseas modificar',
          'Para eliminar: haz clic en 🗑 junto al tercero'
        ]
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
            ['admin',   'Acceso total al sistema'],
            ['cajera',  'Solo Notas de Entrega y abonos — serie caja (≥1.000.000)'],
            ['vendedor','Sus notas (serie vendedor <1.000.000) y su cartera'],
            ['bodega',  'Artículos y proveedores'],
          ]
        }
      },
      {
        subtitulo: 'El usuario PIN',
        texto: 'Existe un usuario especial llamado PIN cuya contraseña funciona como PIN de autorización. Se usa para revertir abonos y desbloquear notas para edición. El administrador puede cambiar el PIN desde este módulo igual que cualquier contraseña.'
      },
      {
        subtitulo: 'Cambiar contraseña',
        texto: 'Cada usuario puede cambiar su propia contraseña en el primer ingreso. El administrador puede resetearla desde el módulo de Usuarios haciendo clic en "🔄 Reset a Atm2026*".'
      }
    ]
  },
]

export default function Manual({ onClose }) {
  const [secActiva, setSecActiva] = useState('inicio')
  const seccion = SECCIONES.find(s => s.id === secActiva)

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.headerTit}>❓ MANUAL DE USUARIO — ATM-APP</span>
        <button onClick={onClose} style={S.btnClose}>✕ Cerrar</button>
      </div>

      <div style={S.body}>
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

        <div style={S.contenido}>
          <div style={S.secTitulo}>
            <span style={{fontSize:28}}>{seccion.icon}</span>
            <span>{seccion.titulo}</span>
          </div>

          {seccion.contenido.map((bloque, i) => (
            <div key={i} style={S.bloque}>
              <div style={S.subTitulo}>{bloque.subtitulo}</div>
              {bloque.texto && <p style={S.texto}>{bloque.texto}</p>}
              {bloque.pasos && (
                <ol style={S.lista}>
                  {bloque.pasos.map((p, j) => <li key={j} style={S.item}>{p}</li>)}
                </ol>
              )}
              {bloque.tabla && (
                <table style={S.tabla}>
                  <thead>
                    <tr style={S.thead}>
                      {bloque.tabla.headers.map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {bloque.tabla.filas.map((fila, j) => (
                      <tr key={j} style={{background: j%2===0?'#fff':'#f5f7ff'}}>
                        {fila.map((cel, k) => <td key={k} style={S.td}>{cel}</td>)}
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
  wrap:          {position:'fixed',inset:0,background:'#f0f2f5',zIndex:2000,display:'flex',flexDirection:'column',fontFamily:'Arial,sans-serif'},
  header:        {background:'linear-gradient(90deg,#1a3a6b,#2c5fa8)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  headerTit:     {color:'#fff',fontWeight:900,fontSize:16,letterSpacing:1},
  btnClose:      {background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'6px 16px',cursor:'pointer',fontSize:13,fontWeight:700},
  body:          {display:'flex',flex:1,overflow:'hidden'},
  sidebar:       {width:220,background:'#1a3a6b',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto'},
  sidebarTit:    {color:'rgba(255,255,255,0.5)',fontSize:10,fontWeight:700,padding:'16px 16px 8px',textTransform:'uppercase',letterSpacing:1},
  sideItem:      {display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'none',border:'none',color:'rgba(255,255,255,0.8)',cursor:'pointer',fontSize:13,textAlign:'left',width:'100%',borderLeft:'3px solid transparent'},
  sideItemActivo:{background:'rgba(255,255,255,0.15)',color:'#fff',borderLeft:'3px solid #ffc107',fontWeight:700},
  contenido:     {flex:1,overflowY:'auto',padding:28},
  secTitulo:     {display:'flex',alignItems:'center',gap:12,fontSize:22,fontWeight:900,color:'#1a3a6b',marginBottom:20,paddingBottom:12,borderBottom:'3px solid #1a3a6b'},
  bloque:        {background:'#fff',borderRadius:8,padding:18,marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'},
  subTitulo:     {fontSize:13,fontWeight:800,color:'#1a3a6b',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5},
  texto:         {fontSize:13,color:'#444',lineHeight:1.7},
  lista:         {paddingLeft:20,margin:0},
  item:          {fontSize:13,color:'#444',lineHeight:1.8,marginBottom:4},
  tabla:         {width:'100%',borderCollapse:'collapse',fontSize:13,marginTop:8},
  thead:         {background:'#1a3a6b'},
  th:            {padding:'8px 12px',color:'#fff',fontWeight:700,textAlign:'left'},
  td:            {padding:'7px 12px',borderBottom:'1px solid #eee',color:'#444'},
}
