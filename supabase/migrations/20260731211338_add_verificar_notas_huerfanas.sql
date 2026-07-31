-- Detecta "huecos peligrosos" en la numeración de notas: registros de Kardex, abonos
-- o movimientos de vale que referencian un numnotaent que no existe en encnotaen.
-- Es el mismo patrón que causó las notas 50435 y 50952 (creadas a medias por fallas
-- ya corregidas en el código). Se hace en el servidor porque artikardex/detabonos
-- tienen demasiadas filas para revisarlas fila por fila desde el navegador.
create or replace function verificar_notas_huerfanas()
returns table(origen text, numnotaent bigint, cantidad bigint, primer_registro timestamptz, ultimo_registro timestamptz)
language sql
stable
as $$
  select 'artikardex'::text as origen, ak.numnotaent, count(*)::bigint, min(ak.fecregistr), max(ak.fecregistr)
  from artikardex ak
  left join encnotaen e on e.numnotaent = ak.numnotaent
  where ak.numnotaent is not null and e.numnotaent is null
  group by ak.numnotaent

  union all

  select 'detabonos'::text, d.numnotaent, count(*)::bigint, min(d.fecregistr), max(d.fecregistr)
  from detabonos d
  left join encnotaen e on e.numnotaent = d.numnotaent
  where e.numnotaent is null
  group by d.numnotaent

  union all

  select 'vale_movimientos'::text, v.numnotaent, count(*)::bigint, min(v.fecregistr), max(v.fecregistr)
  from vale_movimientos v
  left join encnotaen e on e.numnotaent = v.numnotaent
  where v.numnotaent is not null and e.numnotaent is null
  group by v.numnotaent

  order by numnotaent desc nulls last;
$$;

grant execute on function verificar_notas_huerfanas() to anon;
grant execute on function verificar_notas_huerfanas() to authenticated;
grant execute on function verificar_notas_huerfanas() to service_role;
