import { supabase } from './supabase.js';

export async function requireSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  location.replace('/login');
  return new Promise(() => {});
}

export async function signOut() {
  await supabase.auth.signOut();
  location.replace('/');
}
