import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function GoalsPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell userEmail={user.email}>
      <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 12 }}>Goals</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Goal overview and status surface will live here.
        </p>
      </main>
    </AppShell>
  );
}
