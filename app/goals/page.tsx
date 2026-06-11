import { AppShell } from "@/components/layout/app-shell";
import { GoalsWorkspace } from "@/components/features/goals/goals-workspace";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function GoalsPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell userEmail={user.email}>
      <main style={{ padding: 32, maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, display: "grid", gap: 8 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Goals</h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
            Review goals, inspect their related subjects, issues, tasks, and events, and keep the next action in view.
          </p>
        </div>
        <GoalsWorkspace />
      </main>
    </AppShell>
  );
}
