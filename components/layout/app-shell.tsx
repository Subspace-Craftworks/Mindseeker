"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string | null;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          padding: 20,
          borderRadius: 20,
          border: "1px solid var(--line)",
          background: "rgba(255, 255, 255, 0.74)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Mindseeker</div>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {userEmail ? `Signed in as ${userEmail}` : "Signed in"}
          </div>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/chat">Chat</Link>
          <Link href="/goals">Goals</Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              fontWeight: 600,
              cursor: signingOut ? "progress" : "pointer",
            }}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </nav>
      </header>

      <div>{children}</div>
    </div>
  );
}
