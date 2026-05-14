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

  let parsed: { clientId: string; public?: boolean; returnTo?: string };
  try {
    parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf-8"));
  } catch {
    return NextResponse.redirect(
      new URL("/onboarding/connect-google?oauth_error=invalid_state", request.url),
    );
  }
  const clientId = parsed.clientId;
  const isPublicFlow = parsed.public === true;
  // Re-valider returnTo côté callback (defense in depth) : whitelist stricte.
  const ALLOWED_RETURN_PATHS = new Set<string>([
    "/onboarding",
    "/client-area",
    "/client-area/connections",
    "/onboarding/connect-google/done",
  ]);
  const returnTo =
    parsed.returnTo &&
    typeof parsed.returnTo === "string" &&
    parsed.returnTo.startsWith("/") &&
    ALLOWED_RETURN_PATHS.has(parsed.returnTo.split("?")[0])
      ? parsed.returnTo
      : undefined;

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

    // Redirection finale : si returnTo whitelisté présent, on revient là
    // (onboarding ou /client-area/connections), avec un flag de succès.
    // Sinon fallback sur la page done historique (flow public) ou
    // /clients/[id] (flow admin).
    let successUrl: string;
    if (returnTo) {
      successUrl = `${returnTo}?clientId=${clientId}&google=connected`;
    } else if (isPublicFlow) {
      successUrl = `/onboarding/connect-google/done?clientId=${clientId}`;
    } else {
      successUrl = `/clients/${clientId}?oauth=google_ok`;
    }
    return NextResponse.redirect(new URL(successUrl, request.url));
  } catch (err) {
    const errorMsg = encodeURIComponent((err as Error).message);
    let errorUrl: string;
    if (returnTo) {
      errorUrl = `${returnTo}?clientId=${clientId}&oauth_error=${errorMsg}`;
    } else if (isPublicFlow) {
      errorUrl = `/onboarding/connect-google?oauth_error=${errorMsg}`;
    } else {
      errorUrl = `/clients/${clientId}?oauth_error=${errorMsg}`;
    }
    return NextResponse.redirect(new URL(errorUrl, request.url));
  }
}
