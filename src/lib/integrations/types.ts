import "server-only";

/**
 * Types pour le système d'intégrations "1 clic connect".
 *
 * Idée : quand l'agent veut utiliser un tool qui requiert une connexion
 * externe (Gmail, Calendar, Telegram bot, CRM API key, etc.) et que cette
 * connexion n'existe pas pour le client, on n'affiche PAS une erreur
 * technique. À la place :
 *
 *   1. Le tool throw une IntegrationRequiredError(integrationId)
 *   2. brain.ts intercepte ça et génère un message naturel :
 *      "Pour faire ça il me faut un accès à {service}. Clique ici → {url}"
 *   3. L'url ouvre une page /connect/{provider}?clientId=X qui propose
 *      le flow approprié (OAuth pour Google, input clé pour API key, etc.)
 *   4. 1 clic, c'est branché, pour toujours.
 */

export type IntegrationKind = "oauth" | "api_key" | "bot_token";

export interface IntegrationDefinition {
  /** ID stable (snake_case ou kebab-case) */
  id: string;
  /** Nom affiché à l'utilisateur (ex: "Gmail", "Google Calendar") */
  displayName: string;
  /** Court résumé : ce que ça permet de faire (1 phrase) */
  shortPurpose: string;
  /** Catégorie pour grouper (ex: 'google', 'crm', 'messaging') */
  category: "google" | "crm" | "messaging" | "communication" | "other";
  /** Logo emoji ou identifiant icône */
  icon: string;
  /** Type de flow d'auth */
  kind: IntegrationKind;
  /** Couleur principale (hex ou nom tailwind) pour le bouton CTA */
  brandColor: string;
  /**
   * Pour OAuth : URL relative vers laquelle rediriger pour démarrer l'OAuth.
   * Le `clientId` du client sera ajouté en query string.
   * Ex: '/api/oauth/google/start-public' → final URL = '/api/oauth/google/start-public?clientId=X'
   *
   * Pour api_key/bot_token : ce sera l'URL de la page input.
   * Ex: '/connect/icall26' → page avec un input "Colle ta clé API"
   */
  startUrl: string;
  /**
   * Permet de vérifier si l'intégration est déjà connectée pour un client
   * (utilisé par brain.ts pour décider s'il faut redemander ou pas).
   */
  isConnected: (clientId: string) => Promise<boolean>;
}

/**
 * Erreur custom thrown par les tools quand l'intégration requise n'est
 * pas connectée. brain.ts l'intercepte pour générer le message magic-link.
 */
export class IntegrationRequiredError extends Error {
  readonly integrationId: string;
  /** Action que l'agent essayait de faire, utile pour le message naturel */
  readonly contextualHint?: string;

  constructor(integrationId: string, contextualHint?: string) {
    super(
      `Integration "${integrationId}" required but not connected${contextualHint ? `: ${contextualHint}` : ""}`,
    );
    this.name = "IntegrationRequiredError";
    this.integrationId = integrationId;
    this.contextualHint = contextualHint;
  }
}

export function isIntegrationRequiredError(
  err: unknown,
): err is IntegrationRequiredError {
  return (
    err instanceof Error &&
    err.name === "IntegrationRequiredError" &&
    typeof (err as IntegrationRequiredError).integrationId === "string"
  );
}
