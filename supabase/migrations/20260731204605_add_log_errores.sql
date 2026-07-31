-- Registro de errores en operaciones críticas de guardado (notas, artículos, abonos).
-- Sirve para poder auditar cuándo algo falló, en vez de que quede un "hueco"
-- (número de nota u operación consumida sin dejar ningún rastro visible).
create table if not exists log_errores (
  id bigserial primary key,
  fecha timestamptz not null default now(),
  modulo text not null,
  accion text not null,
  numnotaent bigint,
  usuario text,
  mensaje text not null,
  detalle jsonb,
  revisado boolean not null default false
);

create index if not exists idx_log_errores_fecha on log_errores (fecha desc);

alter table log_errores enable row level security;

create policy "log_errores_read" on log_errores for select using (true);
create policy "log_errores_write" on log_errores using (auth.role() = 'authenticated');

grant all on table log_errores to anon;
grant all on table log_errores to authenticated;
grant all on table log_errores to service_role;
grant all on sequence log_errores_id_seq to anon;
grant all on sequence log_errores_id_seq to authenticated;
grant all on sequence log_errores_id_seq to service_role;
