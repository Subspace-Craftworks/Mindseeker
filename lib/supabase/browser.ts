import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/env";

export function createBrowserSupabaseClient() {
  return createClient(getPublicSupabaseUrl(), getPublicSupabaseAnonKey());
}

