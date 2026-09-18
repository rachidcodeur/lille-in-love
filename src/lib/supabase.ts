import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

/**
 * Client Supabase avec la clé service_role.
 *
 * À n'utiliser QUE côté serveur : cette clé contourne la RLS. Elle ne doit
 * jamais être préfixée NEXT_PUBLIC_ ni atteindre le navigateur.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'lille-in-love/inscription' } },
    });
  }
  return client;
}
