import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - api routes (we'll protect those individually)
     * - api/webhooks (Twilio, Stripe, etc. — must be reachable without auth)
     * - whatsapp (admin page used for sandbox testing — must work without
     *   Supabase session in demo mode; protect again once auth is back)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/health|api/test|api/portal|api/webhooks|api/setup-mvp|api/agent-test|whatsapp).*)",
  ],
};
