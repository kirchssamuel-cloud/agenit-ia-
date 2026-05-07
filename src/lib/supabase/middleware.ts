import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Bypass dev : si Supabase pas encore configuré (placeholders), on laisse passer.
  // Se désactive automatiquement dès que les vraies clés Supabase sont en place.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  // Active si les clés Supabase sont des placeholders OU absentes (démo Vercel preview).
  // Se désactive automatiquement dès que les vraies clés Supabase sont en place.
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    supabaseUrl.includes("placeholder") ||
    supabaseKey.includes("placeholder") ||
    supabaseUrl === "" ||
    supabaseKey === "";
  if (isDemoMode) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");
  const isPublicMarketing =
    path === "/" ||
    path.startsWith("/landing") ||
    path.startsWith("/signup") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/choose-modules") ||
    path.startsWith("/checkout") ||
    path.startsWith("/portal");
  const isPublicAsset =
    path.startsWith("/_next") || path.startsWith("/favicon");

  if (!user && !isAuthRoute && !isPublicAsset && !isPublicMarketing) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
