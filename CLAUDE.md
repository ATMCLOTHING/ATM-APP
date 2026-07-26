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

\- \[Pendiente: pídele a Claude Code que lo complete leyendo el proyecto — ver instrucciones abajo]



\## Entorno de pruebas vs. producción

\- \[Pendiente: indicar si existe un proyecto de Supabase de pruebas separado, o si todo se trabaja directo sobre el real]



\## Roles de usuario

\- \[Pendiente: pídele a Claude Code que liste los roles que encuentre en el código de login/permisos]

