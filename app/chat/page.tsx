import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function ChatPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell userEmail={user.email}>
      <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 12 }}>Chat</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Dify-backed chat workspace will live here.
        </p>
      </main>
    </AppShell>
  );
}
