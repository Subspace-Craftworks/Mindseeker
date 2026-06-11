"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

async function signIn(provider: "google" | "github") {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=/chat`,
    },
  });

  if (error) {
    throw error;
  }
}

export function LoginPanel() {
  const [loading, setLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(provider: "google" | "github") {
    setLoading(provider);
    setError(null);
    try {
      await signIn(provider);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Login failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(140, 75, 45, 0.24)",
            background: "rgba(140, 75, 45, 0.08)",
            color: "var(--accent-2)",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      ) : null}
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
