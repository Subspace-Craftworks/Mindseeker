import { LoginPanel } from "@/components/login-panel";

export default function LoginPage() {
  return (
    <main style={{ padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Login</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
        Sign in with Google or GitHub to begin.
      </p>
      <div style={{ marginTop: 24 }}>
        <LoginPanel />
      </div>
    </main>
  );
}
