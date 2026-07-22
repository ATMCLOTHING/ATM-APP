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



\## Rutina de trabajo esperada

1\. El usuario abre PowerShell y se mueve a esta carpeta.

2\. Si la tarea toca la base de datos, el usuario activa el token de Supabase de este proyecto en la sesión (`$env:SUPABASE\_ACCESS\_TOKEN`) antes de abrir Claude Code.

3\. Antes de programar cualquier cambio, mostrar primero un plan simple de qué se va a hacer y esperar aprobación.

4\. Después de hacer el cambio, indicar cómo probarlo antes de seguir.

5\. Antes de `git commit` / `git push`, mostrar un resumen de qué archivos cambiaron y por qué.

6\. Si el cambio toca la base de datos en Supabase, avisar explícitamente y explicar si se debe correr `supabase db push` u otro comando, sin ejecutarlo por cuenta propia sin confirmación.

7\. El usuario es nueva usando terminal y Claude Code: explicar cada paso y cada comando en español simple, sin dar por hecho que conoce la terminal.



\## Reglas para trabajar en este proyecto

\- Explicar siempre los cambios en español, en lenguaje simple y sin tecnicismos innecesarios

\- No borrar ni modificar código sin explicar primero qué se va a cambiar y por qué

\- Antes de hacer commit/push, mostrar un resumen de qué archivos cambiaron

\- Tener cuidado especial con los permisos por rol de usuario (no romper el acceso de otros roles al modificar algo)

\- Si algo toca la base de datos en Supabase, avisar explícitamente antes de ejecutar

\- Si un cambio rompe algo, revertir con git y avisar al usuario — no intentar arreglarlo sobre la marcha sin decirle primero



\## Estructura del proyecto

\- \[Pendiente: pídele a Claude Code que lo complete leyendo el proyecto — ver instrucciones abajo]



\## Entorno de pruebas vs. producción

\- \[Pendiente: indicar si existe un proyecto de Supabase de pruebas separado, o si todo se trabaja directo sobre el real]



\## Roles de usuario

\- \[Pendiente: pídele a Claude Code que liste los roles que encuentre en el código de login/permisos]

