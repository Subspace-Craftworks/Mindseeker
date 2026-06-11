import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const grantType = params.get("grant_type");
    const secret = process.env.OAUTH_JWT_SECRET;
    
    if (!secret) {
      return NextResponse.json({ error: "server_error", error_description: "Missing JWT secret" }, { status: 500 });
    }

    const secretBytes = new TextEncoder().encode(secret);

    if (grantType === "authorization_code") {
      const code = params.get("code");
      if (!code) {
        return NextResponse.json({ error: "invalid_request", error_description: "Missing code parameter" }, { status: 400 });
      }

      // Verify the code (which is a short-lived JWT)
      let payload;
      try {
        const result = await jwtVerify(code, secretBytes);
        payload = result.payload;
      } catch (e) {
        return NextResponse.json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, { status: 400 });
      }

      const userId = payload.user_id as string;
      if (!userId) {
        return NextResponse.json({ error: "invalid_grant", error_description: "Invalid token payload" }, { status: 400 });
      }

      // Issue access_token (1 year) and refresh_token (10 years)
      const accessToken = await new SignJWT({ user_id: userId, type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1y")
        .sign(secretBytes);

      const refreshToken = await new SignJWT({ user_id: userId, type: "refresh" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("10y")
        .sign(secretBytes);

      return NextResponse.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 365 * 24 * 60 * 60, // 1 year in seconds
        refresh_token: refreshToken,
      });
      
    } else if (grantType === "refresh_token") {
      const token = params.get("refresh_token");
      if (!token) {
        return NextResponse.json({ error: "invalid_request", error_description: "Missing refresh_token parameter" }, { status: 400 });
      }

      // Verify the refresh token
      let payload;
      try {
        const result = await jwtVerify(token, secretBytes);
        payload = result.payload;
        if (payload.type !== "refresh") throw new Error("Invalid token type");
      } catch (e) {
        return NextResponse.json({ error: "invalid_grant", error_description: "Invalid or expired refresh token" }, { status: 400 });
      }

      const userId = payload.user_id as string;

      // Issue a new access_token
      const accessToken = await new SignJWT({ user_id: userId, type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1y")
        .sign(secretBytes);

      return NextResponse.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 365 * 24 * 60 * 60,
        // We can optionally issue a new refresh token or just let them use the same one
      });
    }

    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });

  } catch (error) {
    console.error("OAuth Token Error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
