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
}

export const config = {
  matcher: ["/", "/login"],
};
