import { NextResponse, type NextRequest } from "next/server";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { upsertOAuthToken } from "@/lib/db/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/clients?oauth_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      new URL("/clients?oauth_error=missing_params", request.url),
    );
  }

  let parsed: { clientId: string };
  try {
    parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
  } catch {
    return NextResponse.redirect(
      new URL("/clients?oauth_error=invalid_state", request.url),
    );
  }
  const clientId = parsed.clientId;

  try {
    const oauth2 = createGoogleOAuthClient();
    const { tokens } = await oauth2.getToken(code);

    // Lookup the email account from userinfo
    let accountEmail: string | undefined;
    if (tokens.access_token) {
      const res = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
      );
      if (res.ok) {
        const info = (await res.json()) as { email?: string };
        accountEmail = info.email;
      }
    }

    await upsertOAuthToken({
      clientId,
      provider: "google",
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? undefined,
      tokenType: tokens.token_type ?? undefined,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : undefined,
      accountEmail,
    });

    return NextResponse.redirect(
      new URL(`/clients/${clientId}?oauth=google_ok`, request.url),
    );
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        `/clients/${clientId}?oauth_error=${encodeURIComponent((err as Error).message)}`,
        request.url,
      ),
    );
  }
}
