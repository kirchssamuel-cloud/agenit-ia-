import { NextResponse, type NextRequest } from "next/server";
import { ensureLoaded, getClient } from "@/lib/db/store";
import { deleteOAuthToken, type OAuthProvider } from "@/lib/db/oauth";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/disconnect
 * Body: { clientId: string; provider: "google" | "microsoft" }
 *
 * Révoque l'accès OAuth d'un client à un provider en supprimant son
 * token de la table `client_oauth_tokens`. Idempotent : pas d'erreur
 * si déjà déconnecté.
 *
 * Sécurité MVP : vérifie seulement que le clientId existe. Pour la prod
 * réelle, signer le magic-link (JWT court) pour éviter qu'un attaquant
 * qui devine un UUID puisse révoquer les tokens d'un autre client.
 *
 * Note : on ne révoque PAS le token côté Google (pas d'appel à l'API
 * revoke endpoint) car l'utilisateur peut vouloir reconnecter plus tard
 * sans re-passer par le consent screen. Pour révocation totale, il
 * peut le faire depuis myaccount.google.com/permissions.
 */

const ALLOWED_PROVIDERS: OAuthProvider[] = ["google", "microsoft"];

export async function POST(request: NextRequest) {
  let body: { clientId?: string; provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON requis" },
      { status: 400 },
    );
  }

  const { clientId, provider } = body;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json(
      { error: "clientId (string) requis" },
      { status: 400 },
    );
  }

  if (!provider || !ALLOWED_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      {
        error: `provider invalide. Attendu : ${ALLOWED_PROVIDERS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) {
    return NextResponse.json(
      { error: "Client introuvable" },
      { status: 404 },
    );
  }

  try {
    await deleteOAuthToken(clientId, provider as OAuthProvider);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
