import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_CONFIGURACOES } from '../data/seedData';

// Determine initial Supabase credentials (from environment or seed defaults)
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const SUPABASE_URL = (ENV_SUPABASE_URL || INITIAL_CONFIGURACOES.supabaseUrl)?.trim();
const SUPABASE_ANON_KEY = (ENV_SUPABASE_ANON_KEY || INITIAL_CONFIGURACOES.supabaseAnonKey)?.trim();

/**
 * Singleton Supabase Client
 * Initialized once in this central module to avoid:
 * "Multiple GoTrueClient instances detected in the same browser context"
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
