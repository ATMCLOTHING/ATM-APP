# ATM-APP

## Qué es

Sistema de gestión interna para ATM Clothing (jeans).

Administra inventario, clientes, proveedores, cartera, ventas, caja, comisiones, usuarios y demás procesos internos de la empresa.

La aplicación es utilizada simultáneamente por varios usuarios con distintos roles y permisos.

---

# Tecnologías

- Frontend: HTML, CSS y JavaScript.
- Base de datos: PostgreSQL en Supabase.
- Control de versiones: Git + GitHub.
- Despliegue: Vercel (cuando se configure).

---

# Prioridad de configuración

Las políticas de permisos, acceso a herramientas, variables de entorno y modo de ejecución están definidas en:

.claude/settings.json

Este documento NO debe contradecir esa configuración.

Si existe alguna diferencia entre este documento y settings.json, siempre prevalece settings.json.

---

# Información del proyecto

Carpeta local

C:\Mis_Apps\ATM-APP

Repositorio GitHub

https://github.com/atmjeans

Cuenta de GitHub que debe utilizar este proyecto

atmjeans.app@gmail.com

Proyecto Supabase

Reference ID:

snyaahynqqeotsdvsenw

Claude Code ya dispone del token de Supabase mediante settings.json.

No es necesario solicitar que el usuario configure variables de entorno.

---

# Forma de trabajar

Trabajar como un desarrollador senior completamente autónomo.

Se espera que Claude Code:

- Analice el proyecto antes de modificar código.
- Entienda el contexto.
- Investigue cómo funciona el módulo involucrado.
- Implemente la mejor solución.
- Corrija automáticamente errores encontrados.
- Ejecute pruebas.
- Valide el resultado.
- Haga commit.
- Haga push.
- Informe al finalizar.

No detener el trabajo para mostrar planes ni pedir autorización cuando la acción ya esté permitida por settings.json.

La comunicación con la usuaria debe hacerse únicamente cuando el trabajo ya esté realizado o cuando exista un riesgo extraordinario e irreversible.

---

# Autonomía

Claude Code debe ejecutar automáticamente todas las acciones autorizadas por settings.json, incluyendo:

- editar archivos
- crear archivos
- eliminar archivos innecesarios
- ejecutar comandos
- instalar dependencias
- ejecutar npm
- ejecutar node
- ejecutar scripts
- ejecutar Supabase CLI
- ejecutar migraciones
- hacer git add
- hacer git commit
- hacer git push
- corregir errores encontrados durante el proceso
- volver a ejecutar pruebas

No detenerse entre pasos.

Si aparece un error:

- investigar la causa
- intentar otra estrategia
- corregir automáticamente
- volver a probar

Continuar trabajando hasta completar la tarea.

---

# Git

Antes de hacer git push verificar automáticamente:

git config user.email

Debe corresponder a:

atmjeans.app@gmail.com

Si corresponde a otra cuenta:

- corregir la configuración local del repositorio
- realizar el push
- informar después que fue corregido

Nunca detener el trabajo por ese motivo.

---

# Supabase

Este proyecto trabaja directamente sobre producción.

No existe ambiente de pruebas separado.

Claude Code puede:

- ejecutar SQL
- crear migraciones
- ejecutar supabase db push
- ejecutar Supabase CLI
- actualizar funciones
- actualizar políticas
- actualizar tablas

Siempre informar al finalizar:

- qué se modificó
- qué migraciones se ejecutaron
- qué tablas cambiaron

No pedir autorización antes de hacerlo si está permitido por settings.json.

Solo solicitar confirmación cuando una acción implique un riesgo extraordinario e irreversible, por ejemplo:

- borrar completamente una base de datos
- eliminar tablas completas sin respaldo
- eliminar ramas remotas importantes
- operaciones destructivas imposibles de revertir razonablemente

---

# Comunicación

Siempre responder en español.

Explicar en lenguaje sencillo.

No utilizar tecnicismos innecesarios.

Al terminar cualquier tarea informar:

- qué hizo
- qué archivos modificó
- por qué
- cómo probarlo
- qué comandos ejecutó
- qué migraciones ejecutó
- qué commit realizó
- qué push realizó

No describir cada paso antes de hacerlo.

Primero ejecutar.

Después informar.

---

# Calidad del código

Siempre:

- mantener consistencia con el estilo existente
- reutilizar funciones antes de crear nuevas
- evitar duplicación
- eliminar código muerto
- corregir warnings cuando sea posible
- corregir errores relacionados encontrados durante el trabajo aunque no hayan sido solicitados directamente

---

# Roles de usuario

Respetar siempre la lógica existente.

No romper permisos.

No modificar comportamiento de otros roles salvo que la tarea lo requiera.

Roles actuales:

- admin
- cajera
- vendedor
- bodega
- consulta

Los permisos granulares se controlan mediante:

usuario_permisos

No modificar su funcionamiento salvo solicitud expresa.

---

# Autorizaciones especiales

Las acciones sensibles continúan utilizando el mecanismo existente basado en:

ModalAutorizarUsuario.jsx

No reemplazar este mecanismo.

Si se agregan nuevas autorizaciones sensibles utilizar el mismo patrón.

---

# Estructura del proyecto

src/components/

Módulos principales.

src/lib/

Funciones compartidas.

App.jsx

Control de sesión y navegación.

supabase/migrations/

Migraciones oficiales.

sql/

Respaldos.

docs/

Documentación.

.github/workflows/

Automatizaciones.

---

# Objetivo

Priorizar siempre:

1. estabilidad

2. simplicidad

3. mantenibilidad

4. seguridad

5. experiencia del usuario

Antes de finalizar verificar que:

- el proyecto compile
- no existan errores evidentes
- los cambios sean consistentes
- el código quede listo para producción

Si durante el trabajo detectas mejoras pequeñas claramente beneficiosas y de bajo riesgo, impleméntalas sin detenerte y repórtalas al finalizar.

<!-- BEGIN: actualiza-memoria-control-intervencion -->
## Actualizar Control_Intervencion_Diaria.xlsx ("Actualiza Memoria")

Cuando el usuario diga **"Actualiza Memoria"** (o "actualiza memoria") en esta sesión, además de
guardar la memoria de la sesión como normalmente lo harías:

1. Resume en 1-2 líneas qué se hizo en la sesión (será la "Actividad realizada").
2. Define el "Estado tras la intervención": uno de "Al día", "Pendiente", "Atrasado", "Pausado", "Finalizado".
3. Si aplica, define el "Próximo paso" (y opcionalmente una fecha para ese próximo paso).
4. Verifica que `C:\mis_apps\Control_Intervencion_Diaria.xlsx` no esté abierto en Excel (si lo está, pide al usuario que lo cierre y no sigas intentando en loop).
5. Ejecuta en terminal:

   ```
   node C:\mis_apps\excel-tools\log-intervencion.js --proyecto "ATM" --actividad "<resumen>" --estado "<estado>" --proximo "<próximo paso>"
   ```

   El nombre de proyecto de ESTA carpeta en la hoja "Proyectos" de Control_Intervencion_Diaria.xlsx es
   exactamente: **"ATM"** (no lo cambies ni lo traduzcas).

6. Inmediatamente después (SIEMPRE, no solo si algo se ve roto), ejecuta también:

   ```
   node C:\mis_apps\excel-tools\fix-proyectos-formulas.js
   ```

   Motivo: el usuario abre este archivo directamente en Excel entre sesiones, y eso (por una
   causa aún no confirmada) termina pisando con valores fijos las fórmulas de la hoja
   "Proyectos" que traen "Última intervención" y "Qué queda pendiente" desde la Bitácora — ya
   pasó el 2026-09-13 en 17 de 31 filas, incluida Higietex. Este script repara/reescribe esas
   fórmulas siempre; es idempotente y no hace daño correrlo aunque no haga falta.

Nunca edites ese xlsx directamente con ExcelJS ni otro script por tu cuenta: usa siempre
`log-intervencion.js` (ya valida el proyecto/estado, encuentra la fila libre, guarda, y repara
automáticamente unas extensiones de Excel que ExcelJS rompe si se tocan a mano — ver
`C:\mis_apps\excel-tools\fix-extlst.js`) y luego `fix-proyectos-formulas.js` (paso 6 arriba).
<!-- END: actualiza-memoria-control-intervencion -->
