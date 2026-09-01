// Supabase/PostgREST limita cada respuesta a un máximo de filas (1000 en este proyecto) y NO avisa
// que hay más — un .select() sin paginar simplemente corta ahí, sin error. Con tablas grandes
// (encnotaen, detnotaen, detabonos, articulo, clientes, egresos, artikardex...) esto lleva a
// informes con datos incompletos sin que se note. Poner .limit(2000) o .limit(5000) del lado del
// cliente NO alcanza: el servidor igual responde máximo 1000 filas.
//
// fetchAll pagina automáticamente con .range() hasta traer todas las filas que cumplan el filtro.
//
// buildQuery debe ser una función que devuelva un query NUEVO cada vez que se llama (sin .range()
// aplicado), y debe incluir un .order() por una columna única (ej. la llave primaria) para que la
// paginación sea determinística — sin orden, PostgREST no garantiza que la página 2 continúe justo
// donde terminó la página 1.
//
// Uso:
//   const notas = await fetchAll(() => supabase.from('encnotaen')
//     .select('numnotaent,fechanotae,valtotal')
//     .gte('fechanotae', desde).lte('fechanotae', hasta)
//     .order('numnotaent', {ascending:true}))
const PAGE_SIZE = 1000

export async function fetchAll(buildQuery) {
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// Para filtros .in() con listas largas de ids: Supabase usa GET y una lista de miles de valores
// puede exceder el largo máximo de URL. fetchAllIn pide en tandas (chunks) y pagina cada tanda.
// buildQuery(tanda) debe devolver un query nuevo que incluya .in(columna, tanda) y un .order().
export async function fetchAllIn(ids, buildQuery, chunkSize = 300) {
  let result = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const tanda = ids.slice(i, i + chunkSize)
    const rows = await fetchAll(() => buildQuery(tanda))
    result = result.concat(rows)
  }
  return result
}
