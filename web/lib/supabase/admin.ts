import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// service_role client. NEVER import from a client component.
// Use only inside Server Actions / Route Handlers that have already
// authorized the caller themselves (e.g. checked is_admin via the
// per-request session client).
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
