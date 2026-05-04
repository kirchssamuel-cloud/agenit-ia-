import "server-only";
import { google } from "googleapis";

/**
 * Crée un client OAuth2 Google. Les credentials viennent des env vars :
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI (ex: http://localhost:3000/api/oauth/google/callback)
 */
export function createGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth non configuré. Renseigne GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI dans .env.local.",
    );
  }
  return new google.auth.OAuth2({ clientId, clientSecret, redirectUri });
}

export const GMAIL_READONLY_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Construit l'URL d'authentification Google.
 * `state` doit contenir clientId (encodé) pour qu'on sache quel client
 * connecter au retour du callback.
 */
export function buildGoogleAuthUrl(state: string, scopes = GMAIL_READONLY_SCOPES) {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
    include_granted_scopes: true,
  });
}
