\# ATM-APP



\## Qué es

Sistema de gestión interna para ATM Clothing (jeans). Administra inventario de productos y pedidos de clientes. Usado por varios usuarios con distintos roles (no solo un usuario admin).



\## Tecnologías

\- Frontend: HTML / CSS / JS puro (sin framework)

\- Base de datos: SQL, manejada en Supabase



\## Cuentas de este proyecto

\- Carpeta local: `C:\\Mis\_Apps\\ATM-APP`

\- GitHub: usar la cuenta \*\*atmjeans.app@gmail.com\*\* (ya configurada como `git config user.email` en esta carpeta — si Claude ve otra cuenta activa debe avisar antes de hacer push)

\- Supabase: proyecto ya vinculado con `supabase link`, Reference ID \*\*snyaahynqqeotsdvsenw\*\*

\- Vercel: todavía no configurado en este proyecto (pendiente `vercel link`)



\## Modo de trabajo: autónomo

La usuaria trabaja en modo autónomo: **no hay que pausar a pedir aprobación antes de programar, hacer `git commit`, hacer `git push`, ni de tocar la base de datos en Supabase** (incluye correr migraciones/`supabase db push` cuando el cambio lo requiera). Se avisa **después** de hecho, no antes: qué se hizo, qué archivos cambiaron, por qué, y cómo probarlo. Esto reemplaza cualquier paso de "mostrar plan y esperar aprobación" de versiones anteriores de este documento.

Esto NO cambia el resto de las reglas de cuidado (rol de usuario, revertir si algo se rompe, explicar en español simple, no tocar la tabla `clientes` sin decirlo, etc.) — solo elimina la pausa previa. Si una acción es realmente difícil de revertir o de alto riesgo (ej. borrar tablas completas, `--force`), seguir avisando/confirmando antes, igual que el comportamiento por defecto de Claude Code.

## Rutina de trabajo esperada

1\. El usuario abre PowerShell y se mueve a esta carpeta.

2\. Si la tarea toca la base de datos, el usuario activa el token de Supabase de este proyecto en la sesión (`$env:SUPABASE\_ACCESS\_TOKEN`) antes de abrir Claude Code.

3\. Programar el cambio directamente (sin pausa de aprobación previa — ver "Modo de trabajo: autónomo").

4\. Después de hacer el cambio, indicar cómo probarlo.

5\. Después de hacer `git commit` / `git push`, indicar qué archivos cambiaron y por qué.

6\. Si el cambio tocó la base de datos en Supabase, avisar explícitamente qué se ejecutó (o qué falta ejecutar, ej. `supabase db push`, si algo requiere que lo corra la usuaria manualmente por permisos).

7\. El usuario es nueva usando terminal y Claude Code: explicar cada paso y cada comando en español simple, sin dar por hecho que conoce la terminal.



\## Reglas para trabajar en este proyecto

\- Explicar siempre los cambios en español, en lenguaje simple y sin tecnicismos innecesarios

\- Programar/commitear/hacer push/tocar la base de datos sin pausa previa de aprobación — avisar después de hecho (ver "Modo de trabajo: autónomo")

\- Después de hacer commit/push, mostrar un resumen de qué archivos cambiaron

\- Tener cuidado especial con los permisos por rol de usuario (no romper el acceso de otros roles al modificar algo)

\- Si algo tocó la base de datos en Supabase, avisar explícitamente después de ejecutar

\- Si un cambio rompe algo, revertir con git y avisar a la usuaria — no intentar arreglarlo sobre la marcha sin decirle primero



\## Estructura del proyecto

\- `src/components/` — una vista/modal por archivo (React, sin router): `Dashboard.jsx` es el menú principal; `NotaDeEntrega.jsx`, `Cartera.jsx`, `Articulos.jsx`, `Clientes.jsx`, `Proveedores.jsx`, `CierreCaja.jsx`, `Egresos.jsx`, `Comisiones.jsx`, `Vales.jsx`, `Vendedores.jsx`, `ControlDocumentos.jsx`, `GestionUsuarios.jsx` son los módulos; los `Modal*.jsx` son diálogos que se abren desde esos módulos (ej. `ModalAbonos.jsx`, `ModalAutorizarUsuario.jsx`, `ModalPin.jsx`, `ModalDevolucion.jsx`).

\- `src/lib/` — utilidades compartidas: `auth.js` (sesión en localStorage + `tienePermiso()`), `fecha.js` (`fmtFecha` para DD/MM/AAAA), `supabase.js` (cliente Supabase), `assets.js` (íconos/logo).

\- `App.jsx` — controla login y qué se muestra según `usuario.rol` (algunos roles redirigen directo a un módulo, ver "Roles de usuario" abajo).

\- `supabase/migrations/` — migraciones SQL para `supabase db push` (carpeta nueva, no todo el historial de cambios de BD pasó por aquí — antes se corrían sueltas).

\- `sql/` — respaldos/export de esquema y datos (`backup_esquema.sql`, `backup_datos.sql`), no son migraciones a aplicar.

\- `docs/` — capturas de pantalla y archivos de referencia que la usuaria va dejando para explicarle tareas a Claude Code; algunos son grandes o sensibles y no están en git (ver `.gitignore`).

\- `.github/workflows/backup-automatico.yml` — respaldo semanal automático de la base de datos hacia Google Drive.



\## Entorno de pruebas vs. producción

\- No existe un proyecto de Supabase de pruebas separado: solo está linkeado el proyecto real de ATM-APP (ref `snyaahynqqeotsdvsenw`). Todo cambio de base de datos (migraciones, `db push`, SQL directo) se aplica directo sobre producción — no hay ambiente intermedio donde probar primero.



\## Roles de usuario

Columna `usuarios.rol` (texto libre, sin restricción en la base de datos). El código de `src/lib/auth.js`, `App.jsx` y `Dashboard.jsx` trata distinto cada valor:

\- \*\*admin\*\*: acceso total sin restricciones (`tienePermiso()` siempre devuelve `true`).

\- \*\*cajera\*\* / \*\*vendedor\*\*: al iniciar sesión entran derecho a "Nota de Entrega" (nunca ven el menú/Dashboard), y ya traen acceso por defecto a varios módulos sin necesidad de marcarlos en Gestión de Usuarios.

\- \*\*bodega\*\*: al iniciar sesión entra derecho a "Artículos", mismo comportamiento que cajera/vendedor.

\- \*\*consulta\*\*: rol "en blanco" a propósito — sin redirección fija ni módulos por defecto. Es el que hay que usar si se necesita un usuario restringido a un solo módulo puntual (marcando solo ese módulo en "Permisos por módulo" desde Gestión de Usuarios).

\- Los permisos granulares por módulo (`usuario_permisos`: puede\_ver/crear/editar/eliminar/anular) se gestionan desde Gestión de Usuarios. Hay además un permiso especial fuera de esa tabla-por-módulo: \*\*puede\_revertir\_abono\*\* (ligado al módulo "nota"), que controla quién puede revertir abonos en el modal de Abonos sin necesitar autorización de otra persona (ver flujo de autorización más abajo).



\## Autorización de acciones sensibles (step-up auth)

Para acciones sensibles con permiso granular (por ahora: revertir abonos), el botón queda siempre visible para cualquier usuario logueado — no se oculta ni se deshabilita por rol/permiso. La validación ocurre al momento de ejecutar la acción:

\- Si quien tiene la sesión abierta ya está autorizado (admin, o tiene el permiso específico) → solo se pide una confirmación simple y se ejecuta.

\- Si no está autorizado → se abre `ModalAutorizarUsuario.jsx`, que pide usuario y contraseña de una persona que sí esté autorizada, valida contra la tabla `usuarios` y el permiso en `usuario_permisos`, y solo entonces ejecuta la acción.

Este patrón (no el PIN genérico compartido de `ModalPin.jsx`, que sigue usándose sin cambios para anular notas y en Vales) es el que se debe seguir si se agrega autorización a otras acciones sensibles en el futuro.

