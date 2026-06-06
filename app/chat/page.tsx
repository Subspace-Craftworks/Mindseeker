import { AppShell } from "@/components/app-shell";
import { ChatWorkspace } from "@/components/chat-workspace";
import { requireCurrentUser } from "@/lib/supabase/server";

export default async function ChatPage() {
  const user = await requireCurrentUser();

  return (
    <AppShell userEmail={user.email}>
      <main style={{ padding: 0 }}>
        <ChatWorkspace />
      </main>
    </AppShell>
  );
}
