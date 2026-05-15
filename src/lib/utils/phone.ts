/**
 * Normalisation des numéros de téléphone en format E.164.
 *
 * Pourquoi : un user tape "06 12 34 56 78" ou "+33 6 12 34 56 78" dans
 * le signup, alors que Twilio envoie "whatsapp:+33612345678" dans le
 * webhook. Sans normalisation, le match est impossible et l'agent ne
 * reconnaît pas son user.
 *
 * E.164 : "+" + country code + national number, sans espaces ni autres
 * caractères. Total 8-15 chiffres après le +.
 */

export class InvalidPhoneError extends Error {
  constructor(input: string) {
    super(`Numéro de téléphone invalide : "${input}". Format attendu : +33 6 12 34 56 78 ou 06 12 34 56 78.`);
    this.name = "InvalidPhoneError";
  }
}

/**
 * Normalise un numéro vers E.164 ("+33612345678").
 *
 * Stratégie :
 *  - Retire tout sauf chiffres et "+"
 *  - "00xx..." → "+xx..." (préfixe international francophone)
 *  - "0xxxxxxxxx" (10 chiffres) → "+33xxxxxxxxx" (France par défaut)
 *  - Sinon, exige déjà un "+"
 *
 * @throws InvalidPhoneError si le format final n'est pas valide.
 */
export function normalizePhoneE164(phone: string): string {
  if (typeof phone !== "string") {
    throw new InvalidPhoneError(String(phone));
  }

  // 1. Garde uniquement chiffres et "+"
  let normalized = phone.replace(/[^\d+]/g, "");

  if (!normalized) {
    throw new InvalidPhoneError(phone);
  }

  // 2. "00" préfixe international → "+"
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  // 3. "0" national français (10 chiffres) → "+33"
  if (normalized.startsWith("0") && !normalized.startsWith("+")) {
    if (normalized.length !== 10) {
      throw new InvalidPhoneError(phone);
    }
    normalized = `+33${normalized.slice(1)}`;
  }

  // 4. Pas de "+" en tête → si purement national FR (9 chiffres) → +33
  //    sinon refus (on n'invente pas le pays).
  if (!normalized.startsWith("+")) {
    if (/^[1-9]\d{8}$/.test(normalized)) {
      normalized = `+33${normalized}`;
    } else {
      throw new InvalidPhoneError(phone);
    }
  }

  // 5. Validation finale E.164 strict : + suivi de 8 à 15 chiffres,
  //    premier chiffre du country code != 0.
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new InvalidPhoneError(phone);
  }

  return normalized;
}

/**
 * Variante "safe" qui retourne null au lieu de throw. Pratique pour
 * filtrer une liste sans casser le flow.
 */
export function tryNormalizePhoneE164(phone: string): string | null {
  try {
    return normalizePhoneE164(phone);
  } catch {
    return null;
  }
}
