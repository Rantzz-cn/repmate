import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';
if (!window.supabase?.createClient) throw new Error('Supabase client failed to load.');
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
export async function requireUser() { const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error('Please sign in to continue.'); return data.user; }
