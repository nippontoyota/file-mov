import "server-only";
import { createClient } from "@supabase/supabase-js";

// Only Auth account management. All application commands use userClient().
export function invitationClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Invitation service unavailable");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}
