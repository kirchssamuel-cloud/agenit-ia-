import { NextResponse, type NextRequest } from "next/server";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { upsertOAuthToken } from "@/lib/db/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/onboarding/connect-google?oauth_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      new URL("/onboarding/connect-google?oauth_error=missing_params", request.url),
    );
  }

  let parsed: { clientId: string; public?: boolean };
  try {
    parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
  } catch {
    return NextResponse.redirect(
      new URL("/onboarding/connect-google?oauth_error=invalid_state", request.url),
    );
  }
  const clientId = parsed.clientId;
  const isPublicFlow = parsed.public === true;

  // Si flow public (lien magique d'onboarding), pas de check Supabase auth.
  // Si flow admin classique, on requiert une session admin.
  if (!isPublicFlow) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

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

    // Redirection finale : selon flow (public onboarding vs admin)
    const successUrl = isPublicFlow
      ? `/onboarding/connect-google/done?clientId=${clientId}`
      : `/clients/${clientId}?oauth=google_ok`;
    return NextResponse.redirect(new URL(successUrl, request.url));
  } catch (err) {
    const errorUrl = isPublicFlow
      ? `/onboarding/connect-google?oauth_error=${encodeURIComponent((err as Error).message)}`
      : `/clients/${clientId}?oauth_error=${encodeURIComponent((err as Error).message)}`;
    return NextResponse.redirect(new URL(errorUrl, request.url));
  }
}
