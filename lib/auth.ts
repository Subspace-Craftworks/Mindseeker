import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/utils/env";

export async function requireSupabaseUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const accessToken = authHeader.slice("Bearer ".length).trim();
  if (!accessToken) {
    throw new Error("Missing bearer token");
  }

  const client = createClient(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return {
    user: data.user,
    accessToken,
    client,
  };
}

