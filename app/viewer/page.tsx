import { AppShell } from "@/components/layout/app-shell";
import { ViewerWorkspace } from "@/components/features/workspace/viewer-workspace";
import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ViewerPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell userEmail={user.email}>
      <main style={{ padding: 0, height: "100%", width: "100%" }}>
        <ViewerWorkspace />
      </main>
    </AppShell>
  );
}
