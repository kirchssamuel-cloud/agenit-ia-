import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec privilèges admin (service_role).
 * UNIQUEMENT côté serveur. Bypasse Row Level Security.
 * Ne jamais l'utiliser dans un Client Component.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
