import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Tant que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ne sont pas renseignes
// (fichier .env, voir .env.example), l'app fonctionne sur le dataset fictif
// local (public/data/*.json) via src/lib/dataSource.js.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = () => supabase !== null;
