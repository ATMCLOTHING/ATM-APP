-- Agrega el permiso granular "puede_revertir_abono" (módulo 'nota'),
-- usado para autorizar qué usuarios pueden revertir abonos desde el modal de Abonos.
alter table usuario_permisos
  add column if not exists puede_revertir_abono boolean not null default false;
