import { NextResponse, type NextRequest } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";
import { ensureLoaded, getClient } from "@/lib/db/store";

export const dynamic = "force-dynamic";

/**
 * /api/oauth/google/start-public — variante publique du flow OAuth Google.
 *
 * Contrairement à /api/oauth/google/start (qui exige une session Supabase admin),
 * cette route permet à un client final (commercial sans compte admin) de
 * connecter son Gmail / Calendar via un lien magique d'onboarding.
 *
 * Usage : /onboarding?clientId=<UUID> → bouton "Connecter Gmail" →
 *         /api/oauth/google/start-public?clientId=<UUID> → Google OAuth →
 *         /api/oauth/google/callback?state=<base64> → tokens stockés en DB →
 *         redirect vers /onboarding/done
 *
 * Sécurité MVP : pour l'instant, on accepte n'importe quel clientId existant
 * dans la DB. Pour la prod réelle, signer le lien avec un JWT (1 sem TTL).
 */

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json(
      { error: "clientId requis dans la query string" },
      { status: 400 },
    );
  }

  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) {
    return NextResponse.json(
      {
        error: "Client introuvable",
        hint: "Vérifie l'URL du lien d'onboarding ou contacte ton agence.",
      },
      { status: 404 },
    );
  }

  try {
    // State encode le clientId + un flag "public" pour que le callback
    // sache qu'il n'a pas besoin d'auth Supabase.
    const state = Buffer.from(
      JSON.stringify({ clientId, public: true, ts: Date.now() }),
    ).toString("base64url");
    const url = buildGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
