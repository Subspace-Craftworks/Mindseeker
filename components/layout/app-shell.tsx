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
    } catch {
      // Ignore sign-out errors
    } finally {
      // Clear all supabase cookies manually and redirect
      document.cookie.split(";").forEach((c) => {
        const name = c.trim().split("=")[0];
        if (name.startsWith("sb-")) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      });
      window.location.href = "/login";
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.png" alt="Mindseeker Logo" style={{ width: 20, height: 20, objectFit: "contain", borderRadius: 4 }} />
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Mindseeker</div>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {userEmail || "Signed in"}
          </div>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
