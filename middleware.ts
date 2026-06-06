import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/env";

function applyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

export async function middleware(request: NextRequest) {
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
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const protectedRoute = pathname.startsWith("/chat") || pathname.startsWith("/goals");

  if (pathname === "/login" && user) {
    const redirectResponse = NextResponse.redirect(new URL("/chat", request.url));
    applyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (protectedRoute && !user) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    applyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (pathname === "/" && user) {
    const redirectResponse = NextResponse.redirect(new URL("/chat", request.url));
    applyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/chat/:path*", "/goals/:path*"],
};
