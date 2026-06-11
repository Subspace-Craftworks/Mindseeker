import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/features/auth/login-panel";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/chat");
  }

  const params = (await searchParams) ?? {};

  return (
    <main style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Login</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
        Sign in with Google or GitHub to begin.
      </p>
      {params.error ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(140, 75, 45, 0.24)",
            background: "rgba(140, 75, 45, 0.08)",
            color: "var(--accent-2)",
            lineHeight: 1.6,
          }}
        >
          {params.error}
        </div>
      ) : null}
      <div style={{ marginTop: 24 }}>
        <LoginPanel />
      </div>
    </main>
  );
}
