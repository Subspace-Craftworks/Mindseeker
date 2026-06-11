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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: "40px",
          borderBottom: "var(--pane-border)",
          background: "var(--panel)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Mindseeker</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {userEmail || "Signed in"}
          </div>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/chat" style={{ fontSize: 13, fontWeight: 600 }}>Chat</Link>
          <Link href="/goals" style={{ fontSize: 13, fontWeight: 600 }}>Goals</Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "var(--pane-border)",
              background: "var(--panel-2)",
              color: "var(--text)",
              cursor: signingOut ? "progress" : "pointer",
            }}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </nav>
      </header>

      <div style={{ flexGrow: 1, display: "flex", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
