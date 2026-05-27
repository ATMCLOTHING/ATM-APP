// src/lib/supabase.js
// Este archivo crea la conexión con tu base de datos Supabase.
// Lo importas en cualquier componente que necesite datos.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('❌ Falta configurar el archivo .env con las claves de Supabase.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
