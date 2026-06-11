import { AppShell } from "@/components/layout/app-shell";
import { ChatWorkspace } from "@/components/features/chat/chat-workspace";
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
