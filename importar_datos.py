"""
importar_datos.py
══════════════════════════════════════════════════════════════════════════
Importa artículos y notas de entrega (solo 2025-2026) a Supabase.

CÓMO USARLO (paso a paso):
─────────────────────────────────────────────────────────────────────────
1. Abre una terminal (símbolo del sistema / PowerShell / Terminal de Mac)
2. Navega a la carpeta donde están los archivos XLS y este script:
       cd ruta/de/tu/carpeta
3. Instala las librerías necesarias (solo la primera vez):
       pip install xlrd pandas supabase
4. Edita las dos líneas marcadas con ← CAMBIA ESTO
5. Ejecuta:
       python importar_datos.py
══════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import pandas as pd
from supabase import create_client

# ══════════════════════════════════════════════════════════════════════
#  ← CAMBIA ESTO: pega tu URL y tu SERVICE ROLE KEY de Supabase
#  (las encuentras en: Supabase → tu proyecto → Settings → API)
# ══════════════════════════════════════════════════════════════════════
SUPABASE_URL = "https://snyaahynqqeotsdvsenw.supabase.co"
SUPABASE_KEY = "PEGA_AQUI_TU_SERVICE_ROLE_KEY"   # ← la larga que empieza con eyJ...
# ══════════════════════════════════════════════════════════════════════

if "PEGA_AQUI" in SUPABASE_KEY:
    print("❌  Debes pegar tu SERVICE ROLE KEY en este script antes de ejecutarlo.")
    print("    Abre importar_datos.py con un editor de texto y sigue las instrucciones.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Carpeta donde están los XLS (por defecto, la misma carpeta de este script)
CARPETA = os.path.dirname(os.path.abspath(__file__))

def leer_xls(nombre):
    ruta = os.path.join(CARPETA, nombre)
    if not os.path.exists(ruta):
        print(f"⚠️  Archivo no encontrado: {ruta}")
        return pd.DataFrame()
    return pd.read_excel(ruta, engine='xlrd')

def limpiar(valor, tipo='texto'):
    """Convierte NaN y None a valores seguros."""
    if tipo == 'numero':
        try: return float(valor) if pd.notna(valor) else 0.0
        except: return 0.0
    else:
        return str(valor).strip() if pd.notna(valor) and str(valor) != 'nan' else ''

def insertar_lotes(tabla, filas, lote=150):
    """Inserta en lotes para no sobrecargar la API."""
    total = 0
    for i in range(0, len(filas), lote):
        batch = filas[i:i+lote]
        try:
            supabase.table(tabla).insert(batch).execute()
            total += len(batch)
            print(f"  ✔  {tabla}: {total} / {len(filas)} filas insertadas")
        except Exception as e:
            print(f"  ❌  Error en lote {i}-{i+lote}: {e}")

def upsert_lotes(tabla, filas, columna_pk, lote=150):
    """Upsert (insert o actualiza) en lotes."""
    total = 0
    for i in range(0, len(filas), lote):
        batch = filas[i:i+lote]
        try:
            supabase.table(tabla).upsert(batch, on_conflict=columna_pk).execute()
            total += len(batch)
            print(f"  ✔  {tabla}: {total} / {len(filas)} filas procesadas")
        except Exception as e:
            print(f"  ❌  Error en lote {i}-{i+lote}: {e}")

# ══════════════════════════════════════════════════════════════════════
# 1. ARTÍCULOS (cabecera)
# ══════════════════════════════════════════════════════════════════════
print("\n📦  Importando articulo.XLS …")
df = leer_xls('articulo.XLS')
if not df.empty:
    df.columns = [c.strip().lower() for c in df.columns]
    filas = []
    for _, r in df.iterrows():
        cod = limpiar(r.get('codartic'))
        if not cod: continue
        filas.append({
            'codartic':   cod,
            'tipo':       limpiar(r.get('tipo')),
            'tipotalla':  limpiar(r.get('tipotalla')),
            'descartic':  limpiar(r.get('descartic')),
            'genero':     limpiar(r.get('genero')),
            'marca':      limpiar(r.get('marca')),
            'cantactual': limpiar(r.get('cantactual'), 'numero'),
            'cantfisico': limpiar(r.get('cantfisico'), 'numero'),
            'existencia': limpiar(r.get('existencia'), 'numero'),
            'preciovent': limpiar(r.get('preciovent'), 'numero'),
            'preciovend': limpiar(r.get('preciovend'), 'numero'),
            'preciocomp': limpiar(r.get('preciocomp'), 'numero'),
            'estado':     limpiar(r.get('estado')) or 'A',
            'usuario':    limpiar(r.get('usuario')),
        })
    print(f"  Total artículos a importar: {len(filas)}")
    upsert_lotes('articulo', filas, 'codartic')

# ══════════════════════════════════════════════════════════════════════
# 2. ARTÍCULOS POR TALLA (articomp)
# ══════════════════════════════════════════════════════════════════════
print("\n📦  Importando articomp.XLS …")
df = leer_xls('articomp.XLS')
if not df.empty:
    df.columns = [c.strip().lower() for c in df.columns]
    filas = []
    for _, r in df.iterrows():
        cod = limpiar(r.get('codartic'))
        if not cod: continue
        filas.append({
            'codartic':   cod,
            'descartic':  limpiar(r.get('descartic')),
            'marca':      limpiar(r.get('marca')),
            'genero':     limpiar(r.get('genero')),
            'tipo':       limpiar(r.get('tipo')),
            'tipotalla':  limpiar(r.get('tipotalla')),
            'talla':      limpiar(r.get('talla')),
            'codbarras':  limpiar(r.get('codbarras')),
            'preciocomp': limpiar(r.get('preciocomp'), 'numero'),
            'preciovent': limpiar(r.get('preciovent'), 'numero'),
            'preciovend': limpiar(r.get('preciovend'), 'numero'),
            'existencia': limpiar(r.get('existencia'), 'numero'),
            'cantfisico': limpiar(r.get('cantfisico'), 'numero'),
            'porciva':    limpiar(r.get('porciva'),    'numero'),
            'usuario':    limpiar(r.get('usuario')),
        })
    print(f"  Total registros a importar: {len(filas)}")
    # articomp usa insert (no hay PK natural única codartic+talla)
    # Primero vaciamos la tabla para evitar duplicados
    print("  Limpiando tabla articomp antes de importar…")
    supabase.table('articomp').delete().neq('id', 0).execute()
    insertar_lotes('articomp', filas)

# ══════════════════════════════════════════════════════════════════════
# 3. ENCABEZADOS NOTAS (solo 2025-2026)
# ══════════════════════════════════════════════════════════════════════
print("\n📋  Importando encnotaen.XLS (solo 2025-2026) …")
df = leer_xls('encnotaen.XLS')
numeros_validos = set()  # guardamos los nros que sí importamos

if not df.empty:
    df.columns = [c.strip().lower() for c in df.columns]
    # normalizar columna de fecha
    col_fecha = 'fechanotae' if 'fechanotae' in df.columns else df.columns[1]
    df[col_fecha] = pd.to_datetime(df[col_fecha], errors='coerce')
    df = df[df[col_fecha].dt.year >= 2025]
    print(f"  Notas 2025-2026 encontradas: {len(df)}")

    filas = []
    for _, r in df.iterrows():
        num = limpiar(r.get('numnotaent'))
        if not num: continue
        fnotae = r[col_fecha]
        fvence = pd.to_datetime(r.get('fechavence'), errors='coerce')
        filas.append({
            'numnotaent': num,
            'fechanotae': fnotae.date().isoformat() if pd.notna(fnotae) else None,
            'fechavence': fvence.date().isoformat() if pd.notna(fvence) else None,
            'codclient':  limpiar(r.get('codclient')) or '99',
            'cedrifclie': limpiar(r.get('cedrifclie')),
            'nombreclie': limpiar(r.get('nombreclie')),
            'direcicion': limpiar(r.get('direccion') or r.get('direcicion')),
            'celular':    limpiar(r.get('celular')),
            'ciudad':     limpiar(r.get('ciudad')),
            'departamen': limpiar(r.get('departamen')),
            'nomempresa': limpiar(r.get('nomempresa')),
            'formapago':  limpiar(r.get('formapago')) or 'CONTADO',
            'mediopago':  limpiar(r.get('mediopago')) or 'Efectivo',
            'porcdescue': limpiar(r.get('porcdescue'), 'numero'),
            'subtotal':   limpiar(r.get('subtotal'),   'numero'),
            'porciva':    limpiar(r.get('porciva'),     'numero'),
            'valiva':     limpiar(r.get('valiva'),      'numero'),
            'valdescue':  limpiar(r.get('valdescue'),   'numero'),
            'valtotal':   limpiar(r.get('valtotal'),    'numero'),
            'valabono':   limpiar(r.get('valabono'),    'numero'),
            'saldo':      limpiar(r.get('saldo'),       'numero'),
            'cedvended':  limpiar(r.get('cedvended')),
            'cantotal':   limpiar(r.get('cantotal'),    'numero'),
            'anulada':    limpiar(r.get('anulada')) or 'N',
            'usuario':    limpiar(r.get('usuario')),
        })
        numeros_validos.add(num)

    upsert_lotes('encnotaen', filas, 'numnotaent')

# ══════════════════════════════════════════════════════════════════════
# 4. DETALLE NOTAS (solo las que importamos)
# ══════════════════════════════════════════════════════════════════════
print("\n📋  Importando detnotaen.XLS …")
df = leer_xls('detnotaen.XLS')
if not df.empty and numeros_validos:
    df.columns = [c.strip().lower() for c in df.columns]
    df['numnotaent'] = df['numnotaent'].astype(str).str.strip()
    df = df[df['numnotaent'].isin(numeros_validos)]
    print(f"  Líneas de detalle a importar: {len(df)}")

    filas = []
    for _, r in df.iterrows():
        filas.append({
            'numnotaent': limpiar(r.get('numnotaent')),
            'codartic':   limpiar(r.get('codartic')),
            'descartic':  limpiar(r.get('descartic')),
            'marca':      limpiar(r.get('marca')),
            'talla':      limpiar(r.get('talla')),
            'cantidad':   limpiar(r.get('cantidad'),   'numero'),
            'valunit':    limpiar(r.get('valunit'),    'numero'),
            'subtotal':   limpiar(r.get('subtotal'),   'numero'),
            'porciva':    limpiar(r.get('porciva'),    'numero'),
            'valiva':     limpiar(r.get('valiva'),     'numero'),
            'porcdescue': limpiar(r.get('porcdescue'), 'numero'),
            'valdescue':  limpiar(r.get('valdescue'),  'numero'),
            'valtotal':   limpiar(r.get('valtotal'),   'numero'),
            'usuario':    limpiar(r.get('usuario')),
        })
    insertar_lotes('detnotaen', filas)

print("\n✅  ¡Importación completada exitosamente!")
print("    Revisa las tablas en Supabase → Table Editor para verificar los datos.")
