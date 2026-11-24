import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-supabase-anon-key' &&
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.error(
    '❌ CRITICAL CONFIGURATION ERROR: Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing or invalid in frontend/.env. ' +
    'Please configure your genuine Supabase project credentials in frontend/.env.'
  );
}

// Client instance:
// Initialized with genuine project credentials. If credentials are missing, we log a critical error.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://unconfigured.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
