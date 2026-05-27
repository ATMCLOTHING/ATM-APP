-- ═══════════════════════════════════════════════════════════════════════
-- ATM-APP — SQL COMPLETO
-- Ejecutar en: Supabase → SQL Editor → New query → pega todo → Run
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. ARTÍCULOS (cabecera sin talla) ──────────────────────────────────
create table if not exists public.articulo (
  codartic    text        primary key,
  tipo        text,
  tipotalla   text,
  descartic   text,
  genero      text,
  marca       text,
  cantactual  numeric     default 0,
  cantfisico  numeric     default 0,
  codproveed  text,
  nomproveed  text,
  existencia  numeric     default 0,
  existminim  numeric     default 0,
  preciovent  numeric     default 0,
  preciovend  numeric     default 0,
  preciovenv  numeric     default 0,
  preciocomp  numeric     default 0,
  estado      text        default 'A',
  fecregistr  timestamptz default now(),
  usuario     text
);

-- ── 2. ARTÍCULOS POR TALLA (la que se usa en el formulario) ────────────
create table if not exists public.articomp (
  id          bigserial   primary key,
  codartic    text        not null,
  descartic   text,
  marca       text,
  genero      text,
  tipo        text,
  tipotalla   text,
  talla       text,
  codbarras   text,
  codvisible  text,
  color       text,
  preciocomp  numeric     default 0,
  preciovent  numeric     default 0,
  preciovend  numeric     default 0,
  preciovenv  numeric     default 0,
  existencia  numeric     default 0,
  existminim  numeric     default 0,
  existmaxim  numeric     default 0,
  cantfisico  numeric     default 0,
  porciva     numeric     default 0,
  fecregistr  timestamptz default now(),
  usuario     text
);

create index if not exists idx_articomp_codartic  on public.articomp(codartic);
create index if not exists idx_articomp_desc      on public.articomp(descartic);

-- ── 3. ENCABEZADO NOTA DE ENTREGA ──────────────────────────────────────
create table if not exists public.encnotaen (
  numnotaent  text        primary key,
  fechanotae  date,
  fechavence  date,
  fecultabon  date,
  codclient   text,
  cedrifclie  text,
  nombreclie  text,
  direcicion  text,
  celular     text,
  ciudad      text,
  departamen  text,
  nomempresa  text,
  formapago   text        default 'CONTADO',
  mediopago   text        default 'Efectivo',
  porcdescue  numeric     default 0,
  subtotal    numeric     default 0,
  porciva     numeric     default 0,
  valiva      numeric     default 0,
  valdescue   numeric     default 0,
  valtotal    numeric     default 0,
  valabono    numeric     default 0,
  saldo       numeric     default 0,
  cedvended   text,
  cantotal    numeric     default 0,
  anulada     text        default 'N',
  fecregistr  timestamptz default now(),
  usuario     text
);

create index if not exists idx_encnotaen_fecha    on public.encnotaen(fechanotae);
create index if not exists idx_encnotaen_cliente  on public.encnotaen(codclient);
create index if not exists idx_encnotaen_vended   on public.encnotaen(cedvended);

-- ── 4. DETALLE NOTA DE ENTREGA ─────────────────────────────────────────
create table if not exists public.detnotaen (
  id          bigserial   primary key,
  numnotaent  text        not null references public.encnotaen(numnotaent) on delete cascade,
  codartic    text,
  descartic   text,
  marca       text,
  talla       text,
  cantidad    numeric     default 0,
  valunit     numeric     default 0,
  subtotal    numeric     default 0,
  porciva     numeric     default 0,
  valiva      numeric     default 0,
  porcdescue  numeric     default 0,
  valdescue   numeric     default 0,
  valtotal    numeric     default 0,
  fecregistr  timestamptz default now(),
  usuario     text
);

create index if not exists idx_detnotaen_nota    on public.detnotaen(numnotaent);
create index if not exists idx_detnotaen_artic   on public.detnotaen(codartic);

-- ── 5. ABONOS ──────────────────────────────────────────────────────────
create table if not exists public.detabonos (
  id          bigserial   primary key,
  numnotaent  text        not null references public.encnotaen(numnotaent) on delete cascade,
  fechaabono  date        default current_date,
  valabono    numeric     default 0,
  mediopago   text        default 'Efectivo',
  observacio  text,
  fecregistr  timestamptz default now(),
  usuario     text
);

create index if not exists idx_detabonos_nota on public.detabonos(numnotaent);

-- ── 6. ROW LEVEL SECURITY (RLS) ────────────────────────────────────────
-- Permite leer a todos (anon) y escribir solo a usuarios autenticados.
-- Ajusta según la política de seguridad de tu empresa.

alter table public.articulo  enable row level security;
alter table public.articomp  enable row level security;
alter table public.encnotaen enable row level security;
alter table public.detnotaen enable row level security;
alter table public.detabonos enable row level security;

-- articulo
drop policy if exists "articulo_read"   on public.articulo;
drop policy if exists "articulo_write"  on public.articulo;
create policy "articulo_read"  on public.articulo  for select using (true);
create policy "articulo_write" on public.articulo  for all    using (auth.role() = 'authenticated');

-- articomp
drop policy if exists "articomp_read"   on public.articomp;
drop policy if exists "articomp_write"  on public.articomp;
create policy "articomp_read"  on public.articomp  for select using (true);
create policy "articomp_write" on public.articomp  for all    using (auth.role() = 'authenticated');

-- encnotaen
drop policy if exists "enc_read"   on public.encnotaen;
drop policy if exists "enc_write"  on public.encnotaen;
create policy "enc_read"   on public.encnotaen for select using (true);
create policy "enc_write"  on public.encnotaen for all    using (auth.role() = 'authenticated');

-- detnotaen
drop policy if exists "det_read"   on public.detnotaen;
drop policy if exists "det_write"  on public.detnotaen;
create policy "det_read"   on public.detnotaen for select using (true);
create policy "det_write"  on public.detnotaen for all    using (auth.role() = 'authenticated');

-- detabonos
drop policy if exists "ab_read"   on public.detabonos;
drop policy if exists "ab_write"  on public.detabonos;
create policy "ab_read"   on public.detabonos for select using (true);
create policy "ab_write"  on public.detabonos for all    using (auth.role() = 'authenticated');
