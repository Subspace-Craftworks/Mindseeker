import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/utils/env";

function applyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

function syncCookies(
  request: NextRequest,
  response: NextResponse,
  cookiesToSet: Array<{ name: string; value: string; options: Parameters<typeof response.cookies.set>[2] }>
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    request.cookies.set(name, value);
    response.cookies.set(name, value, options);
  });
}

export async function middleware(request: NextRequest) {
  try {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          syncCookies(request, response, cookiesToSet);
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const protectedRoute = pathname === "/";

    if (pathname === "/login" && user) {
      const redirectResponse = NextResponse.redirect(new URL("/", request.url));
      applyCookies(response, redirectResponse);
      return redirectResponse;
    }

    if (protectedRoute && !user) {
      const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
      applyCookies(response, redirectResponse);
      return redirectResponse;
    }

    return response;
  } catch (error: any) {
    // If it fails (e.g. missing env vars), return the actual error so we can see it on Vercel
    return new NextResponse(
      JSON.stringify({
        error: "Middleware Error",
        message: error?.message || String(error),
        stack: error?.stack,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export const config = {
  matcher: ["/", "/login"],
};
