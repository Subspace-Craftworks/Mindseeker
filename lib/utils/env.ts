function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getPublicSupabaseUrl() {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

export function getPublicSupabaseAnonKey() {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function getDifyApiBaseUrl() {
  return required("DIFY_API_BASE_URL");
}

export function getDifyApiKey() {
  return required("DIFY_API_KEY");
}
