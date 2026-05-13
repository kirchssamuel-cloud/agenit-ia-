import "server-only";
import { google } from "googleapis";
import { createGoogleOAuthClient } from "./oauth";
import { getOAuthToken, upsertOAuthToken } from "@/lib/db/oauth";
import { IntegrationRequiredError } from "@/lib/integrations/types";

/**
 * Helper pour obtenir un client Google OAuth déjà authentifié pour un
 * client donné, avec persistance automatique du refresh.
 *
 * Avant cette factorisation : 3 tools (read-gmail-inbox, gmail-archive,
 * read-google-calendar) dupliquaient le pattern, et 2 sur 3 ne
 * persistaient PAS le refresh token (bug identifié en code review).
 *
 * Throw IntegrationRequiredError si pas de token en DB → brain.ts
 * intercepte et envoie le magic link.
 *
 * Usage :
 *   const oauth2 = await getAuthedGoogleClient(clientId, "lire les emails");
 *   const gmail = google.gmail({ version: "v1", auth: oauth2 });
 *   const calendar = google.calendar({ version: "v3", auth: oauth2 });
 */
export async function getAuthedGoogleClient(
  clientId: string,
  contextualHint?: string,
): Promise<ReturnType<typeof createGoogleOAuthClient>> {
  const tokenRecord = await getOAuthToken(clientId, "google");
  if (!tokenRecord) {
    throw new IntegrationRequiredError("google", contextualHint);
  }

  const oauth2 = createGoogleOAuthClient();
  oauth2.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken ?? undefined,
    scope: tokenRecord.scope ?? undefined,
    token_type: tokenRecord.tokenType ?? undefined,
    expiry_date: tokenRecord.expiresAt
      ? new Date(tokenRecord.expiresAt).getTime()
      : undefined,
  });

  // Auto-persist le refresh token rotaté par Google.
  // Critique : sans ça, le refresh marche en mémoire mais le prochain
  // appel re-fetch le vieux token de la DB et fail.
  oauth2.on("tokens", async (newTokens) => {
    try {
      await upsertOAuthToken({
        clientId,
        provider: "google",
        accessToken: newTokens.access_token ?? tokenRecord.accessToken,
        refreshToken:
          newTokens.refresh_token ?? tokenRecord.refreshToken ?? undefined,
        scope: newTokens.scope ?? tokenRecord.scope ?? undefined,
        tokenType: newTokens.token_type ?? tokenRecord.tokenType ?? undefined,
        expiresAt: newTokens.expiry_date
          ? new Date(newTokens.expiry_date)
          : undefined,
        accountEmail: tokenRecord.accountEmail ?? undefined,
      });
    } catch (err) {
      console.warn(
        `[google-auth] échec persistance token rafraîchi : ${(err as Error).message}`,
      );
    }
  });

  return oauth2;
}

/** Re-exporte googleapis pour confort (un seul import dans les tools). */
export { google };
