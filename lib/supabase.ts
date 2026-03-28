import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://munsyiizenfbmkwiupzm.supabase.co"
const supabaseAnonKey = "sb_publishable_FYPbL8-2I4LQbFk05EO4FA_HktPpBhj"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)