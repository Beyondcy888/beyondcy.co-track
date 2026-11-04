import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check .env.local or the GitHub secrets.');
}

// The one and only Supabase client. Import it from here everywhere.
// Only the project URL and the publishable (anon) key are ever used: RLS protects the data.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for the password-reset link
    flowType: 'pkce',
  },
});
