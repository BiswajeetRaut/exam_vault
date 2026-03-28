import { createClient } from "@supabase/supabase-js"

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }

  return createClient(url, serviceRole)
}
