import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/chat");
  }

  return (
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 40, marginBottom: 12 }}>Mindseeker</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.7, maxWidth: 720 }}>
        Supabase Auth, Vercel FE/BFF, and Dify integration scaffold.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link href="/login">Login</Link>
        <Link href="/chat">Chat</Link>
        <Link href="/goals">Goals</Link>
      </div>
    </main>
  );
}
