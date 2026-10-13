import { createClient, SupabaseClient } from '@supabase/supabase-js';

// URL oficial fornecida pelo usuário do projeto Supabase
export const DEFAULT_SUPABASE_URL = 'https://yybuuxaegmzmupcbliut.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5YnV1eGFlZ216bXVwY2JsaXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDEzMzgsImV4cCI6MjEwNzQ3NzMzOH0.hWGqg8PgAcQWkTlYYazhgqndJLu3elnPrRwjU2JIazQ';

// Lê variáveis de ambiente caso existam ou utiliza a URL oficial hardcoded
const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_URL = (ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
export const SUPABASE_ANON_KEY = (ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

/**
 * Singleton Supabase Client
 * Inicializado uma única vez neste módulo centralizado com a URL oficial:
 * https://yybuuxaegmzmupcbliut.supabase.co
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
