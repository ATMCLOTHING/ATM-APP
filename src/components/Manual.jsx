// src/components/Manual.jsx
import { useState } from 'react'

const SECCIONES = [
  {
    id: 'inicio',
    icon: '🚀',
    titulo: 'Inicio y Acceso',
    contenido: [
      {
        subtitulo: 'Cómo ingresar al sistema',
        texto: 'Abre el navegador y ve a https://atm-app-alpha.vercel.app. Escribe tu usuario y contraseña y haz clic en Ingresar. Si es tu primer ingreso, el sistema te pedirá cambiar la contraseña inicial Atm2026* por una propia.'
      },
      {
        subtitulo: 'Roles y permisos',
        tabla: {
          headers: ['Rol', 'Quién lo usa', 'Qué puede hacer'],
          filas: [
            ['admin', 'Administrador', 'Todo el sistema sin restricciones'],
            ['cajera', 'Cajera del punto de venta', 'Notas de entrega, abonos, vales, cierre de caja'],
            ['vendedor', 'Vendedora externa', 'Sus propias notas y su cartera'],
            ['bodega', 'Encargada de bodega', 'Artículos, proveedores y entradas de mercancía'],
            ['PIN', 'Especial', 'Contraseña de autorización para acciones restringidas — solo el admin la conoce'],
          ]
        }
      },
      {
        subtitulo: 'Cerrar sesión',
        texto: 'Haz clic en el botón ⏻ en la esquina superior derecha del Dashboard principal.'
      }
    ]
  },
  {
    id: 'nota',
    icon: '📋',
    titulo: 'Nota de Entrega',
    contenido: [
      {
        subtitulo: '¿Qué es una Nota de Entrega?',
        texto: 'Es el documento principal de venta. Registra qué artículos se vendieron, a qué cliente, a qué precio, cuándo y cómo se pagó. Existen dos series: notas de Caja (números desde 1.000.000, usadas por cajeras) y notas de Vendedor (números menores, usadas por vendedoras externas).'
      },
      {
        subtitulo: 'Cómo crear una Nota de Entrega',
        pasos: [
          'Haz clic en el ícono ➕ Nueva (hoja en blanco) en la barra inferior izquierda',
          'Si eres administrador, elige la serie antes de crear: Caja (≥1.000.000) en el combo izquierdo',
          'Ingresa la cédula del cliente en el campo CÉDULA / NIT y presiona Enter — si el cliente existe, sus datos se cargan automáticamente',
          'Si la cédula no está registrada, el sistema abre un formulario para crear el cliente nuevo',
          'Para buscar un cliente por nombre en vez de cédula, haz clic en la lupa 🔍 junto al campo de cédula',
          'Selecciona el Vendedor escribiendo su nombre en el campo — aparece un listado desplegable filtrable',
          'Elige el tipo de precio: Mayor (por defecto), Detal o Vendedor',
          'En la tabla de artículos, escribe el código en la columna Cód. Artículo y presiona Enter',
          'Si hay varias coincidencias aparece un listado para elegir',
          'Ajusta la cantidad si necesitas más de 1 unidad',
          'Repite para cada artículo',
          'Elige el plazo de pago (Contado, 8 días, 15 días, etc.) — la fecha de pago se calcula sola',
          'Elige el medio de pago (Efectivo, Transferencia, Mixto o Crédito)',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Cómo ingresar artículos con pistola de código de barras',
        pasos: [
          'Ubica el cursor en el campo de código de la siguiente fila vacía',
          'Apunta la pistola al código de barras del artículo y dispara',
          'El sistema lee el código, busca el artículo y lo agrega automáticamente',
          'Si el artículo ya está en la nota, suma 1 a la cantidad existente en vez de agregar otra línea',
          'Si el código tiene varias referencias, aparece un listado para elegir la correcta',
          'El cursor queda listo para escanear el siguiente artículo sin tener que hacer nada más'
        ]
      },
      {
        subtitulo: 'Cómo navegar entre notas existentes',
        tabla: {
          headers: ['Botón', 'Qué hace'],
          filas: [
            ['⏮ (Primera)', 'Va a la primera nota registrada en el sistema'],
            ['◀ (Anterior)', 'Va a la nota anterior'],
            ['▶ (Siguiente)', 'Va a la nota siguiente'],
            ['⏭ (Última)', 'Va a la nota más reciente'],
            ['🔍 (Binoculares)', 'Abre el buscador — puedes filtrar por número de nota, cédula del cliente, nombre o rango de fechas'],
          ]
        }
      },
      {
        subtitulo: 'Cómo buscar una nota',
        pasos: [
          'Haz clic en el botón 🔍 (binoculares) en la barra inferior',
          'Escribe el número de nota, la cédula del cliente o su nombre',
          'Opcionalmente filtra por estado (Todas, Pendientes, Pagadas, Anuladas) y por rango de fechas',
          'Haz clic en 🔍 Buscar',
          'En el listado de resultados, haz clic en la nota que deseas abrir',
          'La nota se carga completa con todos sus datos y detalle de artículos'
        ]
      },
      {
        subtitulo: 'Cómo registrar un abono',
        pasos: [
          'Abre la nota a la que deseas abonar',
          'Haz clic en el botón 💵 Abonos en la parte inferior derecha',
          'Escribe el valor del abono',
          'Elige la fecha y el medio de pago',
          'Haz clic en 💾 Registrar abono — el saldo se actualiza automáticamente',
          'Puedes ver el historial de todos los abonos de esa nota en la misma pantalla'
        ]
      },
      {
        subtitulo: 'Cómo pagar una nota completa de una sola vez',
        pasos: [
          'Abre la nota',
          'Haz clic en 💰 Pagar Todo en la parte inferior derecha',
          'El sistema registra el abono por el saldo total pendiente y la nota queda en $0'
        ]
      },
      {
        subtitulo: 'Cómo revertir un abono',
        pasos: [
          'Abre la nota y haz clic en 💵 Abonos',
          'En el historial, cada abono tiene dos opciones: ↩ Total y ↩ Parcial',
          '↩ Total: revierte el abono completo — el saldo vuelve a lo que era antes',
          '↩ Parcial: escribe el valor que deseas revertir junto al botón y haz clic — el resto del abono queda intacto',
          'En ambos casos el sistema pedirá el PIN de administrador para confirmar'
        ]
      },
      {
        subtitulo: 'Cómo aplicar un vale como parte de pago',
        pasos: [
          'Abre la nota que tiene saldo pendiente',
          'Haz clic en 🎫 Aplicar Vale en la parte inferior derecha',
          'Escribe el código del vale, el nombre del cliente o su cédula en el campo de búsqueda',
          'Haz clic en 🔍 Buscar — si hay varios resultados, elige el correcto de la lista',
          'El sistema muestra el saldo disponible del vale',
          'Ajusta el valor a aplicar si deseas usar solo una parte del vale',
          'Haz clic en ✅ Aplicar vale — el saldo de la nota se reduce y el vale queda con el saldo restante'
        ]
      },
      {
        subtitulo: 'Cómo hacer una devolución (con nota de origen)',
        pasos: [
          'Busca y abre la nota de entrega original de la prenda que van a devolver',
          'En la tabla de artículos, cada línea ya guardada tiene un botón ↩ al lado derecho',
          'Haz clic en ↩ de la prenda que se devuelve',
          'Escribe la cantidad a devolver — puede ser 1 o más unidades, pero no más de las que había en esa línea',
          'Haz clic en ↩ Devolver',
          'El inventario se restaura automáticamente',
          'Si la nota ya estaba totalmente pagada: se genera un vale por el valor devuelto. Aparece un modal con el código del vale y el botón 🖨 Imprimir comprobante',
          'Si la nota tenía saldo pendiente: el valor devuelto se descuenta de ese saldo. Aparece el comprobante sin vale'
        ]
      },
      {
        subtitulo: 'Cómo hacer una devolución (sin nota de origen)',
        pasos: [
          'Crea una nota nueva para lo que el cliente va a comprar normalmente',
          'En una fila vacía, busca o escribe el código del artículo que el cliente devuelve',
          'En el campo Cantidad, escribe el número en negativo — por ejemplo -1',
          'Esa línea negativa resta su valor del total de la nota',
          'El cliente paga solo la diferencia entre lo que compra y lo que devuelve',
          'Guarda la nota normalmente',
          'Nota: este método no genera vale. Si el valor devuelto es mayor que lo que el cliente compra, es mejor usar el método con nota de origen'
        ]
      },
      {
        subtitulo: 'Cómo desbloquear una nota para editarla',
        pasos: [
          'Una nota ya guardada queda bloqueada para evitar cambios accidentales',
          'Haz clic en el botón 🔒 (candado dorado) en la barra de botones',
          'Ingresa el PIN de administrador',
          'La nota muestra el badge 🔓 EDITANDO — todos los campos quedan disponibles para editar',
          'Realiza los cambios y haz clic en 💾 Guardar',
          'Para cancelar sin guardar, haz clic de nuevo en el candado'
        ]
      },
      {
        subtitulo: 'Cómo anular una nota',
        pasos: [
          'Solo el administrador puede anular notas',
          'Abre la nota y haz clic en el ícono 🗑 Anular en la barra de botones',
          'Ingresa el motivo de anulación cuando el sistema lo pida',
          'La nota queda marcada como ANULADA, el inventario se restaura automáticamente y el documento queda en el historial'
        ]
      },
      {
        subtitulo: 'Cómo imprimir una nota',
        texto: 'Haz clic en el ícono 🖨️ Imprimir en la barra de botones. Se abre una vista de impresión optimizada para impresora de tickets de 80mm. Al imprimir, desactiva los encabezados y pies de página en las opciones del diálogo de impresión para que el ticket salga limpio.'
      },
      {
        subtitulo: 'Botones de la barra inferior — referencia rápida',
        tabla: {
          headers: ['Botón', 'Qué hace'],
          filas: [
            ['📄 (hoja)', 'Nueva nota'],
            ['Serie Caja/Vendedor', 'Elige la serie para la próxima nota nueva (solo admin)'],
            ['🔵 (pigmento)', 'Duplicar la nota actual'],
            ['↩ (revertir)', 'Revertir cambios no guardados a la última versión guardada'],
            ['🔒/🔓 (candado)', 'Bloquear o desbloquear la nota para edición (requiere PIN)'],
            ['📊 (resumen)', 'Ver el detalle completo de la nota en pantalla grande'],
            ['⚖️ (balanza)', 'Dividir la nota entre varios pagadores'],
            ['🏃 (correr)', 'Anular la nota actual (requiere motivo)'],
            ['💵 Abonos', 'Ver historial y registrar abonos'],
            ['💰 Pagar Todo', 'Saldar la nota completa de una vez'],
            ['🎫 Aplicar Vale', 'Usar un vale como parte de pago'],
          ]
        }
      }
    ]
  },
  {
    id: 'vales',
    icon: '🎫',
    titulo: 'Vales',
    contenido: [
      {
        subtitulo: '¿Qué es un vale?',
        texto: 'Es un crédito a favor del cliente generado cuando devuelve mercancía de una nota que ya estaba totalmente pagada. Funciona como una tarjeta de regalo: tiene un código único, un saldo disponible y se puede usar como parte de pago en cualquier nota futura, en una o varias compras hasta agotar el saldo.'
      },
      {
        subtitulo: 'Cuándo se genera un vale automáticamente',
        texto: 'El sistema crea el vale en el momento de registrar una devolución (botón ↩ en la nota), siempre que la nota ya estuviera totalmente pagada. Si la nota tenía saldo pendiente, la devolución simplemente reduce ese saldo y no genera vale.'
      },
      {
        subtitulo: 'Cómo consultar un vale',
        pasos: [
          'Ve al módulo 🎫 Consultar Vales desde el menú principal',
          'Busca por código del vale, nombre del cliente o cédula',
          'Haz clic en un vale de la lista para ver su detalle completo',
          'El panel derecho muestra el cliente, el motivo, el saldo disponible y el historial de movimientos (emisión y cada uso)'
        ]
      },
      {
        subtitulo: 'Cómo reimprimir un vale',
        pasos: [
          'Ve a Consultar Vales y selecciona el vale de la lista',
          'Haz clic en 🖨 Reimprimir en el panel derecho',
          'Se abre el comprobante en formato ticket 80mm listo para imprimir'
        ]
      },
      {
        subtitulo: 'Cómo anular un vale',
        pasos: [
          'Ve a Consultar Vales y selecciona el vale',
          'Haz clic en 🚫 Anular en el panel derecho',
          'El sistema pedirá el PIN de administrador',
          'Una vez anulado, el vale no puede usarse ni reactivarse'
        ]
      },
      {
        subtitulo: 'Estados de un vale',
        tabla: {
          headers: ['Estado', 'Qué significa'],
          filas: [
            ['ACTIVO', 'Tiene saldo disponible y se puede usar'],
            ['AGOTADO', 'Se usó completamente — saldo en $0'],
            ['ANULADO', 'Fue cancelado manualmente por el administrador'],
          ]
        }
      }
    ]
  },
  {
    id: 'clientes',
    icon: '👤',
    titulo: 'Clientes',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer en esta pantalla?',
        texto: 'Ver el listado completo de clientes, crear nuevos, editar sus datos y desactivarlos. Un cliente desactivado no aparece en las búsquedas de la Nota de Entrega pero queda en el historial.'
      },
      {
        subtitulo: 'Cómo crear un cliente',
        pasos: [
          'Haz clic en "+ Nuevo" en la parte superior',
          'Completa los datos: cédula o NIT, nombre, teléfono, celular, dirección, ciudad y empresa',
          'El nombre es el único campo obligatorio — los demás son opcionales',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Cómo buscar y editar un cliente',
        pasos: [
          'Escribe en la barra de búsqueda — filtra en tiempo real por nombre, cédula o empresa',
          'Haz clic en el cliente en la lista de la izquierda',
          'Sus datos aparecen en el formulario de la derecha listos para editar',
          'Realiza los cambios y haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Cómo crear un cliente desde la Nota de Entrega',
        texto: 'Si escribes una cédula en la Nota de Entrega que no existe en el sistema y presionas Enter, el sistema abre automáticamente el formulario de nuevo cliente con la cédula ya ingresada. Completa los datos, guarda y el cliente queda seleccionado en la nota.'
      },
      {
        subtitulo: 'Cliente General',
        texto: 'El cliente con cédula 99 llamado "CLIENTE GENERAL" es el cliente por defecto para ventas rápidas donde no se requiere identificar al comprador. No se puede eliminar.'
      }
    ]
  },
  {
    id: 'articulos',
    icon: '📦',
    titulo: 'Artículos',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer en esta pantalla?',
        texto: 'Crear, buscar, editar y consultar artículos del inventario. También puedes registrar entradas de mercancía (nuevos lotes) desde aquí.'
      },
      {
        subtitulo: 'Cómo crear un artículo nuevo',
        pasos: [
          'Haz clic en el ícono ➕ Nueva en la barra inferior',
          'Ingresa el código del artículo — debe ser único',
          'Completa la descripción, tipo (JEAN, CAMISETA, etc.), marca, género y talla (U para talla única)',
          'Ingresa los tres precios: Compra, Mayor (venta principal), Detal y Vendedor',
          'Ingresa la existencia inicial en el campo Existencias',
          'Selecciona el proveedor si aplica',
          'Haz clic en 💾 Guardar — el artículo queda disponible inmediatamente en la Nota de Entrega'
        ]
      },
      {
        subtitulo: 'Cómo buscar y editar un artículo',
        pasos: [
          'Haz clic en el ícono 🔍 Listado en la barra inferior',
          'Busca por código o descripción',
          'Haz clic en el artículo del listado — se carga en el formulario con todos sus datos',
          'Modifica los campos que necesites',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Cómo registrar una entrada de mercancía (nuevo lote)',
        pasos: [
          'Busca y abre el artículo al que deseas ingresar unidades',
          'Haz clic en el botón 📦 Entrada en la barra inferior',
          'Escribe la cantidad a ingresar',
          'Elige el concepto de la lista: Segundo lote, Segundas a primeras, Ajuste de inventario, Devolución de proveedor, Corrección de conteo físico, Bonificación de proveedor, Traslado entre bodegas u Otro',
          'Agrega una observación adicional si lo necesitas',
          'Haz clic en 📦 Registrar entrada',
          'Las existencias se actualizan en el momento y queda el movimiento registrado en el kardex'
        ]
      },
      {
        subtitulo: 'Tipos de precio',
        tabla: {
          headers: ['Tipo', 'Campo', 'Cuándo se usa'],
          filas: [
            ['Mayor', 'preciovent', 'Precio de venta principal — es el que carga la nota por defecto'],
            ['Detal', 'preciovend', 'Precio para venta al detal individual'],
            ['Vendedor', 'preciovenv', 'Precio especial para vendedoras externas'],
          ]
        }
      },
      {
        subtitulo: 'Cómo navegar entre artículos',
        tabla: {
          headers: ['Botón', 'Qué hace'],
          filas: [
            ['⏮', 'Primer artículo'],
            ['◀', 'Artículo anterior'],
            ['▶', 'Artículo siguiente'],
            ['⏭', 'Último artículo'],
            ['🔍 Listado', 'Abre el buscador de artículos'],
            ['📦 Entrada', 'Registrar ingreso de unidades al artículo actual'],
            ['📋 Duplicar', 'Crea un artículo nuevo con los mismos datos del actual para editar'],
            ['↩ Revertir', 'Cancela los cambios no guardados'],
            ['🗑 Eliminar', 'Elimina el artículo (solo si no tiene movimientos)'],
          ]
        }
      },
      {
        subtitulo: 'Inventario y kardex',
        texto: 'El inventario se descuenta automáticamente al guardar una nota de entrega y se restaura al anularla o registrar una devolución. Todos esos movimientos quedan registrados en el kardex con fecha, usuario, cantidad y existencia resultante. Cuando se cargue el histórico del sistema anterior, el kardex quedará completo desde el inicio.'
      }
    ]
  },
  {
    id: 'proveedores',
    icon: '🏭',
    titulo: 'Proveedores',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer en esta pantalla?',
        texto: 'Registrar y consultar los proveedores de la empresa. Un proveedor puede asociarse a los artículos para saber de quién viene cada referencia.'
      },
      {
        subtitulo: 'Cómo crear un proveedor',
        pasos: [
          'Haz clic en ➕ Nuevo en la barra de navegación',
          'Ingresa el NIT/cédula y el nombre o razón social',
          'Selecciona el tipo de proveedor del combo desplegable (Insumos de Confección, Textiles, Servicios de Confección, etc.)',
          'Si el tipo no existe, haz clic en el botón + junto al combo para crear uno nuevo',
          'Completa los datos de contacto: dirección, teléfonos, celular, email y ciudad',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Tipos de proveedor disponibles',
        tabla: {
          headers: ['Tipo'],
          filas: [
            ['Insumos de Confección'],
            ['Textiles'],
            ['Servicios de Confección'],
            ['Marquillería'],
            ['Insumos de empacado'],
            ['Maquinaria y Equipos'],
            ['Gestión Empresarial'],
            ['Tecnología'],
            ['Producto Terminado'],
          ]
        }
      }
    ]
  },
  {
    id: 'vendedores',
    icon: '🙋',
    titulo: 'Vendedores',
    contenido: [
      {
        subtitulo: '¿Qué puedes hacer en esta pantalla?',
        texto: 'Crear, consultar, editar y retirar vendedores. Un vendedor retirado queda en el historial pero no aparece en el combo de selección de la Nota de Entrega. Solo el administrador tiene acceso a esta pantalla.'
      },
      {
        subtitulo: 'Cómo crear un vendedor',
        pasos: [
          'Haz clic en "+ Nuevo" en la parte superior derecha',
          'Ingresa la cédula (opcional pero recomendada), el nombre completo y el celular',
          'Ingresa el porcentaje de comisión si aplica — este es el porcentaje que usa el módulo de Comisiones para liquidar',
          'El estado queda en Activo por defecto',
          'Haz clic en 💾 Guardar'
        ]
      },
      {
        subtitulo: 'Cómo retirar un vendedor',
        pasos: [
          'Selecciona el vendedor en la lista de la izquierda',
          'Haz clic en 🚪 Retirar en la barra de botones',
          'El botón cambia a "¿Confirmar retiro?" — haz clic de nuevo para confirmar',
          'El vendedor queda con estado Retirado: ya no aparece en el combo de la Nota de Entrega pero sigue visible en el historial y en los informes'
        ]
      }
    ]
  },
  {
    id: 'cierre',
    icon: '📊',
    titulo: 'Cierre de Caja / Informes',
    contenido: [
      {
        subtitulo: '¿Qué es y para qué sirve?',
        texto: 'Permite ver un resumen completo de las ventas del día (o de cualquier período): cuánto se vendió, cómo se pagó, quién vendió más y cuánto hay pendiente por cobrar. También permite imprimir el cierre para archivo físico.'
      },
      {
        subtitulo: 'Cómo generar los informes',
        pasos: [
          'Selecciona el rango de fechas con los campos Desde y Hasta',
          'Haz clic en 🔍 Generar Informes',
          'Navega entre las pestañas según lo que necesites ver',
          'Usa el botón 🖨 Imprimir en la pestaña activa para imprimir ese informe específico'
        ]
      },
      {
        subtitulo: 'Pestaña Consolidado',
        texto: 'Muestra las ventas del período organizadas por vendedor y por caja, con columnas de efectivo, transferencia, mixto, crédito, saldo pendiente y total. Al final aparece la fila de TOTALES GENERALES. La marca DIGITAL aparece aparte en un recuadro morado y no se suma al total del cierre de caja.'
      },
      {
        subtitulo: 'Pestaña Ventas por Marca',
        texto: 'Muestra cuántas unidades y cuánto dinero se vendió de cada marca en el período. La fila de TOTALES excluye la marca DIGITAL — esta aparece en la tabla pero con fondo morado para indicar que no entra al cierre. Esto permite llevar por separado las ventas digitales.'
      },
      {
        subtitulo: 'Pestaña Ventas por Cliente',
        texto: 'Lista los clientes que compraron en el período con el total de cada uno, ordenados de mayor a menor. Útil para identificar los mejores clientes del período.'
      },
      {
        subtitulo: 'Pestaña Resumen del Día',
        texto: 'Vista compacta con los totales más importantes: total de ventas, ventas de contado, ventas a crédito, efectivo, transferencia, mixto, abonos recibidos, total de dinero ingresado y saldo pendiente por cobrar. La marca DIGITAL aparece aparte. También muestra el comparativo con el día anterior.'
      },
      {
        subtitulo: 'Pestaña Top Artículos',
        texto: 'Muestra los artículos más vendidos del período por cantidad de unidades, con su total en pesos. Útil para saber qué referencias están rotando más.'
      },
      {
        subtitulo: 'Pestaña Cartera Pendiente',
        texto: 'Lista todas las notas que tienen saldo por cobrar, ordenadas por antigüedad. Muestra el cliente, la fecha, el total de la nota y el saldo pendiente.'
      }
    ]
  },
  {
    id: 'egresos',
    icon: '💸',
    titulo: 'Control de Egresos',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Módulo para registrar todos los gastos y salidas de dinero de la empresa: arriendo, servicios, compras de insumos, pagos a proveedores, etc. Permite hacer seguimiento de en qué se está gastando el dinero.'
      },
      {
        subtitulo: 'Cómo registrar un egreso',
        pasos: [
          'Ve al módulo 💸 Egresos desde el Dashboard',
          'En la pestaña + Registrar Egreso, selecciona el Tipo de Egreso de la lista desplegable',
          'Escribe el subdetalle o descripción específica del gasto',
          'Selecciona el período al que corresponde el gasto (fechas de inicio y fin)',
          'Ingresa la fecha de pago',
          'Elige el medio de pago (Efectivo, Transferencia, etc.)',
          'Busca o escribe el nombre del beneficiario en el campo correspondiente',
          'Ingresa el valor neto',
          'Si aplica recargo o descuento, ingrésalo en los campos correspondientes — el total se calcula automáticamente',
          'Agrega una observación si lo necesitas',
          'Haz clic en 💾 Guardar Egreso'
        ]
      },
      {
        subtitulo: 'Cómo consultar e imprimir egresos',
        pasos: [
          'Ve a la pestaña 🔍 Consultar / Imprimir',
          'Selecciona el rango de fechas y filtra por tipo o medio de pago si necesitas',
          'Haz clic en 🔍 Consultar',
          'Para imprimir el reporte haz clic en 🖨 Imprimir'
        ]
      },
      {
        subtitulo: 'Cómo gestionar tipos de egreso',
        pasos: [
          'Haz clic en el botón ⚙️ Gestionar Tipos de Egreso en la parte superior',
          'Para agregar: escribe el nombre y haz clic en ➕ Agregar',
          'Para eliminar: haz clic en la × junto al tipo que deseas borrar'
        ]
      },
      {
        subtitulo: 'Cómo gestionar terceros (beneficiarios)',
        pasos: [
          'Haz clic en el botón 👥 Gestionar Terceros en la parte superior',
          'Para agregar: completa cédula, nombre, ciudad y teléfono, luego haz clic en ➕ Agregar',
          'Para editar: haz clic en ✏️ junto al tercero',
          'Para eliminar: haz clic en 🗑 junto al tercero',
          'Los terceros guardados aparecen como sugerencias al escribir en el campo Beneficiario del formulario de egreso'
        ]
      },
      {
        subtitulo: 'Resumen por Categoría',
        texto: 'La pestaña 📊 Resumen muestra tarjetas visuales con el total gastado en cada categoría durante el período seleccionado y el porcentaje que representa del total. Útil para ver de un vistazo en qué rubros se concentra el gasto.'
      }
    ]
  },
  {
    id: 'cartera',
    icon: '📈',
    titulo: 'Cartera',
    contenido: [
      {
        subtitulo: '¿Qué es?',
        texto: 'Vista consolidada de todas las notas que tienen saldo pendiente por cobrar. Permite saber quién debe, cuánto y desde cuándo, para hacer seguimiento de cobros.'
      },
      {
        subtitulo: 'Cómo usar la pantalla de cartera',
        pasos: [
          'El listado se carga automáticamente al abrir el módulo',
          'Puedes filtrar por vendedor, por cliente o por rango de fechas',
          'Haz clic en cualquier nota del listado para abrirla directamente en la Nota de Entrega y registrar un abono'
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
        texto: 'Módulo para calcular y liquidar las comisiones de las vendedoras sobre sus ventas pagadas. El porcentaje de comisión de cada vendedora se configura en la pantalla de Vendedores.'
      },
      {
        subtitulo: 'Cómo liquidar comisiones',
        pasos: [
          'Ve a la pestaña 💵 Liquidar Comisión',
          'Selecciona la vendedora',
          'Opcionalmente filtra por rango de fechas',
          'Haz clic en 🔍 Buscar notas — muestra todas las notas pagadas de esa vendedora que no han sido liquidadas',
          'Las notas vienen seleccionadas por defecto — desmarca las que no desees incluir',
          'El sistema calcula automáticamente el valor de la comisión',
          'Haz clic en 💾 Liquidar y confirma',
          'Las notas quedan marcadas como liquidadas y no vuelven a aparecer en próximas liquidaciones'
        ]
      },
      {
        subtitulo: 'Historial de liquidaciones',
        texto: 'En la pestaña 📋 Historial puedes ver todas las liquidaciones registradas con fecha, vendedora, monto total de ventas, porcentaje aplicado y valor de la comisión.'
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
        texto: 'Solo el administrador tiene acceso a este módulo. Permite crear, editar y desactivar los usuarios que pueden entrar al sistema.'
      },
      {
        subtitulo: 'Cómo crear un usuario',
        pasos: [
          'Ve al módulo Usuarios desde el Dashboard',
          'Haz clic en "+ Nuevo"',
          'Ingresa el nombre de usuario (con el que va a entrar al sistema), el nombre real, una contraseña inicial y el rol',
          'Haz clic en 💾 Guardar — el usuario puede ingresar inmediatamente'
        ]
      },
      {
        subtitulo: 'Roles disponibles',
        tabla: {
          headers: ['Rol', 'Qué puede hacer'],
          filas: [
            ['admin', 'Acceso total sin restricciones'],
            ['cajera', 'Notas de entrega, abonos, vales y cierre de caja — serie caja (≥1.000.000)'],
            ['vendedor', 'Sus propias notas (serie vendedor), su cartera y vales'],
            ['bodega', 'Artículos, proveedores y entradas de mercancía'],
          ]
        }
      },
      {
        subtitulo: 'El PIN de administrador',
        texto: 'Existe un usuario especial llamado PIN cuya contraseña actúa como código de autorización. Se usa para revertir abonos, desbloquear notas y anular vales. El administrador puede cambiar este PIN desde el módulo de Usuarios igual que cualquier otra contraseña. Mantenlo confidencial.'
      },
      {
        subtitulo: 'Cómo resetear la contraseña de un usuario',
        texto: 'Selecciona el usuario en la lista y haz clic en 🔄 Reset a Atm2026*. El usuario deberá cambiarla en su próximo ingreso.'
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
        <span style={S.headerTit}>❓ MANUAL DE USUARIO — ATM CONTROL DE INVENTARIOS</span>
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
  texto:         {fontSize:13,color:'#444',lineHeight:1.7,margin:0},
  lista:         {paddingLeft:20,margin:0},
  item:          {fontSize:13,color:'#444',lineHeight:1.8,marginBottom:4},
  tabla:         {width:'100%',borderCollapse:'collapse',fontSize:13,marginTop:8},
  thead:         {background:'#1a3a6b'},
  th:            {padding:'8px 12px',color:'#fff',fontWeight:700,textAlign:'left'},
  td:            {padding:'7px 12px',borderBottom:'1px solid #eee',color:'#444'},
}
