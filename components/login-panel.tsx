"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

async function signIn(provider: "google" | "github") {
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/chat`,
    },
  });
}

export function LoginPanel() {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);

  async function handleSignIn(provider: "google" | "github") {
    setLoading(provider);
    try {
      await signIn(provider);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button
        type="button"
        onClick={() => handleSignIn("google")}
        disabled={loading !== null}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--accent)",
          color: "white",
          fontWeight: 600,
          cursor: loading ? "progress" : "pointer",
        }}
      >
        {loading === "google" ? "Google login..." : "Continue with Google"}
      </button>
      <button
        type="button"
        onClick={() => handleSignIn("github")}
        disabled={loading !== null}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "white",
          color: "var(--text)",
          fontWeight: 600,
          cursor: loading ? "progress" : "pointer",
        }}
      >
        {loading === "github" ? "GitHub login..." : "Continue with GitHub"}
      </button>
    </div>
  );
}
