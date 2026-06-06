import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseUrl, getSupabaseServiceRoleKey } from "@/lib/env";

export function createSupabaseServiceClient() {
  return createClient(getPublicSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false },
  });
}

