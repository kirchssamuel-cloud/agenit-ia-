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
 * Scopes étendus pour agent IA "tout-en-un" : lecture + écriture Gmail
 * (archive/send), Calendar (create event), Drive (lecture/recherche),
 * Contacts (list/create). Demandés au moment de l'OAuth initial pour
 * que l'agent ait tout après une seule autorisation.
 *
 * - gmail.modify : lire + archiver (englobe gmail.readonly)
 * - gmail.send : envoyer un email depuis le compte du user
 * - calendar : list events + create event
 * - drive.readonly : list + search files (read-only pour rassurer l'user)
 * - contacts : list + create contacts
 * - userinfo.email : pour stocker accountEmail
 */
export const FULL_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Construit l'URL d'authentification Google.
 * `state` doit contenir clientId (encodé) pour qu'on sache quel client
 * connecter au retour du callback.
 *
 * Par défaut on demande FULL_GOOGLE_SCOPES (Gmail+Calendar+Drive+Contacts)
 * pour éviter à l'utilisateur de re-passer par l'OAuth à chaque service.
 */
export function buildGoogleAuthUrl(state: string, scopes = FULL_GOOGLE_SCOPES) {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
    include_granted_scopes: true,
  });
}
