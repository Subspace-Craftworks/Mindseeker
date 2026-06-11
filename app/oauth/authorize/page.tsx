import { redirect } from "next/navigation";
import { SignJWT } from "jose";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OAuthAuthorizePage(
  props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const searchParams = await props.searchParams;
  const clientId = searchParams.client_id;
  const redirectUri = searchParams.redirect_uri;
  const state = searchParams.state;
  const responseType = searchParams.response_type;

  if (typeof clientId !== "string" || typeof redirectUri !== "string" || responseType !== "code") {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif" }}>
        <h1>Invalid OAuth Request</h1>
        <p>Missing or invalid parameters: client_id, redirect_uri, or response_type=code.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Redirect to login, preserving the oauth parameters
    const currentUrl = `/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&state=${state ?? ""}`;
    redirect(`/login?next=${encodeURIComponent(currentUrl)}`);
  }

  async function approveAction() {
    "use server";
    
    // Check session again in the server action
    const supabaseAction = await createSupabaseServerClient();
    const {
      data: { session: actionSession },
    } = await supabaseAction.auth.getSession();

    if (!actionSession) {
      redirect("/login");
    }

    const secret = process.env.OAUTH_JWT_SECRET;
    if (!secret) throw new Error("OAUTH_JWT_SECRET not configured");

    // Generate a short-lived authorization code (valid for 5 minutes)
    const code = await new SignJWT({ user_id: actionSession.user.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(secret));

    // Redirect back to the client's redirect_uri with the code and state
    const url = new URL(redirectUri as string);
    url.searchParams.set("code", code);
    if (state) {
      url.searchParams.set("state", state as string);
    }
    redirect(url.toString());
  }

  async function denyAction() {
    "use server";
    const url = new URL(redirectUri as string);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "User denied access");
    if (state) {
      url.searchParams.set("state", state as string);
    }
    redirect(url.toString());
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 500, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Authorization Request</h1>
      <p style={{ marginBottom: 24, lineHeight: 1.5, color: "#555" }}>
        <strong>{clientId}</strong> is requesting access to your Mindseeker account. 
        This will allow the application to read and write your goals, tasks, issues, and events on your behalf.
      </p>

      <div style={{ display: "flex", gap: 12 }}>
        <form action={approveAction}>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "#0f766e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Allow Access
          </button>
        </form>
        <form action={denyAction}>
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              background: "#e5e7eb",
              color: "#374151",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Deny
          </button>
        </form>
      </div>
    </div>
  );
}
