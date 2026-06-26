# Cambios entregados — ATM-APP

## 1. Cómo instalar esto

1. **Primero ejecuta el SQL.** Entra a Supabase → SQL Editor → New query → pega TODO el
   contenido de `sql/migracion_vales_proveedores.sql` → Run.
   Crea las tablas `vales`, `vale_movimientos`, `tipos_proveedor` (con los 9 tipos de tu
   Excel ya precargados) y una función para generar el código de cada vale (`V-000001`,
   `V-000002`…). Es seguro volver a correrlo si algo falla a mitad de camino.

2. **Luego sube los archivos de `src/components/` a tu repo**, reemplazando los que ya
   existen y agregando los 3 nuevos, respetando exactamente esta ruta:
   ```
   src/components/NotaDeEntrega.jsx          (reemplaza)
   src/components/ModalAbonos.jsx            (reemplaza)
   src/components/CierreCaja.jsx             (reemplaza)
   src/components/Proveedores.jsx            (reemplaza)
   src/components/Egresos.jsx                (reemplaza)
   src/components/ModalDevolucion.jsx        (nuevo)
   src/components/ModalVale.jsx              (nuevo)
   src/components/ModalNuevoTipoProveedor.jsx (nuevo)
   ```
   No hay que tocar `package.json` ni nada más — no agregué dependencias nuevas.

3. Probé que todo compila (`npm run build`) sin errores antes de entregarlo.

---

## 2. Qué cambió en cada punto

### Punto 1 — Devoluciones y vales
- En la grilla de la Nota de Entrega, cada línea **ya guardada** ahora tiene un botón
  **↩** (en vez del ✕, que solo aparece mientras la nota no está guardada o la
  desbloqueas con el PIN). Al hacer clic te pregunta cuántas unidades devuelves
  (igual a la dinámica que me mostraste), restaura el inventario, y:
  - Si la nota ya estaba **totalmente pagada**, genera un **vale** (`vales` +
    `vale_movimientos`) con el valor de la devolución y te muestra el código.
  - Si la nota tenía saldo pendiente, simplemente reduce ese saldo. Si la devolución
    vale más que el saldo pendiente, el excedente también se convierte en vale.
- Agregué el botón **🎫 Aplicar Vale** junto a Abonos/Pagar Todo: busca el vale por
  código y lo aplica (total o parcial) como abono de la nota actual. El vale lleva su
  saldo disponible y queda trazado en `vale_movimientos`.
- El **Caso B** (cliente sin la nota original, se ingresa el artículo con cantidad
  negativa en la nota nueva) ya funcionaba en la base del código; solo le quité la
  restricción de cantidad mínima que lo bloqueaba.

### Punto 2 — Reversión de abonos parcial o total
En el modal de Abonos, cada abono ahora tiene dos acciones:
- **↩ Total**: igual que antes, revierte el abono completo (requiere PIN).
- **↩ Parcial**: digitas el valor a revertir junto al abono y confirma con PIN; el
  resto del abono queda intacto. Si digitas un valor igual o mayor al abono completo,
  se trata automáticamente como reversión total.

### Punto 3 — Marca DIGITAL aparte en Cierre de Caja
En las pestañas **Consolidado** y **Resumen del Día** ahora aparece un recuadro
morado aparte: *"📲 MARCA DIGITAL (no incluida en el cierre de caja)"*. Ese valor se
resta de todos los totales (efectivo/transferencia/mixto/crédito/total general) antes
de sumarlos, y también se excluyó de las versiones para imprimir.

### Punto 4 — Tipos de Proveedor
El campo "Tipo" en Proveedores ahora es un combo desplegable (alimentado por la tabla
`tipos_proveedor`, ya con tus 9 tipos del Excel) con un botón **+** al lado que abre un
modalito para crear tipos nuevos al vuelo — mismo patrón que ya usan para "Marcas".

### Punto 5 — Error de Egresos corregido
Encontré la causa: el formulario intentaba guardar un campo `descegreso` (y `tipocod`)
heredados de un diseño de "subtipos" que nunca quedó conectado a una tabla real — por
eso Supabase rechazaba el insert. Quité esos campos fantasma del guardado; ahora usa
únicamente lo que tu pantalla ya muestra: el grupo seleccionado y el texto libre de
"Subdetalle/Descripción". No requiere cambios en la base de datos.

---

## 3. Cosas que decidí por mi cuenta (avísame si quieres que las cambie)

- El valor de la devolución se calcula sobre el **precio efectivo ya facturado**
  (con descuento e IVA de esa línea incluidos), no sobre el precio de lista.
- Si devuelves una cantidad que cubre *más* que el saldo pendiente de una nota a
  crédito, el excedente se va a un vale en vez de dejarlo como saldo negativo.
- El vale no queda "amarrado" a un cliente específico de forma estricta — cualquiera
  con el código puede aplicarlo (igual que un vale físico de papel). Si prefieres que
  solo lo pueda usar el mismo cliente al que se le emitió, lo ajusto.
