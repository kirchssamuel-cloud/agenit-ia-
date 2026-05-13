import "server-only";
import { getOAuthToken } from "@/lib/db/oauth";
import type { IntegrationDefinition } from "./types";

/**
 * Registre central des intégrations disponibles.
 *
 * Ajouter une nouvelle intégration = ajouter une entrée ici + créer un
 * tool ou une page /connect/{id}/page.tsx. C'est tout.
 */

async function googleConnected(clientId: string): Promise<boolean> {
  try {
    const token = await getOAuthToken(clientId, "google");
    return Boolean(token?.accessToken);
  } catch {
    return false;
  }
}

// Non utilisé pour l'instant (icall26/telegram retournent false explicitement
// car les API keys sont globales en MVP). À utiliser quand on aura une vraie
// table client_integrations par-client.
// function envKeyConfigured(envVar: string): boolean {
//   const v = process.env[envVar];
//   return Boolean(v && !v.includes("placeholder"));
// }

export const INTEGRATIONS: Record<string, IntegrationDefinition> = {
  google: {
    id: "google",
    displayName: "Gmail + Google Calendar",
    shortPurpose: "Lire tes emails et ton calendrier, archiver, gérer ton planning.",
    category: "google",
    icon: "📧",
    kind: "oauth",
    brandColor: "#4285F4",
    startUrl: "/api/oauth/google/start-public",
    isConnected: googleConnected,
  },
  // Gmail et Calendar partagent le même OAuth Google. Les tools peuvent
  // référencer "google" ou "gmail"/"calendar" — on les alias.
  gmail: {
    id: "gmail",
    displayName: "Gmail",
    shortPurpose: "Lire et trier ta boîte mail automatiquement.",
    category: "google",
    icon: "📧",
    kind: "oauth",
    brandColor: "#EA4335",
    startUrl: "/api/oauth/google/start-public",
    isConnected: googleConnected,
  },
  calendar: {
    id: "calendar",
    displayName: "Google Calendar",
    shortPurpose: "Lire tes RDV pour préparer ton planning.",
    category: "google",
    icon: "📅",
    kind: "oauth",
    brandColor: "#1FA463",
    startUrl: "/api/oauth/google/start-public",
    isConnected: googleConnected,
  },
  icall26: {
    id: "icall26",
    displayName: "iCall26 CRM",
    shortPurpose:
      "Pousser tes leads et lire l'historique d'appels depuis iCall26.",
    category: "crm",
    icon: "📞",
    kind: "api_key",
    brandColor: "#F97316",
    startUrl: "/connect/icall26",
    // En MVP, l'API key iCall26 est globale (env var) — pas par-client.
    // Donc on retourne toujours `false` côté isConnected pour montrer la
    // page "bientôt en self-service" plutôt qu'un faux "déjà branché"
    // basé sur l'env var globale. Quand on aura une table client_integrations
    // par-client, on switchera sur un vrai check.
    isConnected: async () => false,
  },
  telegram: {
    id: "telegram",
    displayName: "Telegram",
    shortPurpose: "Recevoir des notifications et discuter sur Telegram aussi.",
    category: "messaging",
    icon: "✈️",
    kind: "bot_token",
    brandColor: "#229ED9",
    startUrl: "/connect/telegram",
    // Idem iCall26 : token global pour l'instant, donc on dit toujours
    // "pas connecté pour ce client" pour éviter le faux positif.
    isConnected: async () => false,
  },
};

export function getIntegrationDef(
  id: string,
): IntegrationDefinition | undefined {
  return INTEGRATIONS[id];
}

export function listIntegrations(): IntegrationDefinition[] {
  return Object.values(INTEGRATIONS);
}
