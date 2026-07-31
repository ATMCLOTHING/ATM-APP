-- La política "log_errores_write" quedó exigiendo auth.role()='authenticated', pero esta
-- app no usa el login de Supabase Auth (usa su propio login contra la tabla "usuarios"),
-- así que esa condición nunca se cumple y bloqueaba el registro del log. Se ajusta al
-- mismo patrón ya usado en tablas equivalentes (artikardex, vales, vale_movimientos):
-- RLS activo pero con policy abierta (el control de acceso real lo hace la app).
drop policy if exists "log_errores_write" on log_errores;
create policy "log_errores_write" on log_errores using (true) with check (true);
