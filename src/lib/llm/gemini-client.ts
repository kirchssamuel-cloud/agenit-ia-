import "server-only";

/**
 * Client Gemini (Google AI Studio) — wrapper minimal pour appeler
 * Gemini 2.5 Flash en tant qu'alternative GRATUITE à Anthropic Claude.
 *
 * Free tier (mai 2026) :
 *   - Gemini 2.5 Flash : 10 req/min, 500 req/jour, 0€
 *   - Gemini 2.5 Flash-Lite : 15 req/min, 1000 req/jour, 0€
 *
 * Pas de carte bleue, juste une clé API depuis https://aistudio.google.com/apikey
 *
 * Limites de ce wrapper (MVP) :
 *   - Pas de tool use / function calling (à ajouter quand on aura validé que
 *     la qualité conversationnelle est OK pour notre cas d'usage)
 *   - Pas de streaming
 *   - Conversation single-turn (pas d'historique multi-messages)
 *
 * Quand l'usage est validé, on intégrera Gemini dans brain.ts via un router
 * multi-provider qui choisit Gemini ou Anthropic selon une env var.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiModel =
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-2.5-pro";

export interface GeminiChatInput {
  /** System instruction (prompt système, équivalent du `system` d'Anthropic) */
  systemPrompt?: string;
  /** Message utilisateur courant */
  userMessage: string;
  /** Historique (alternance user / model). N'inclut PAS le userMessage courant. */
  history?: Array<{ role: "user" | "model"; text: string }>;
  /** Modèle à utiliser. Défaut : gemini-2.5-flash. */
  model?: GeminiModel;
  /** Température (créativité). Défaut : 0.7 */
  temperature?: number;
  /** Max tokens en sortie. Défaut : 2048 */
  maxOutputTokens?: number;
}

export interface GeminiChatOutput {
  /** Texte généré par le modèle */
  text: string;
  /** Tokens utilisés en entrée */
  tokensIn: number;
  /** Tokens utilisés en sortie */
  tokensOut: number;
  /** Modèle effectivement utilisé */
  model: GeminiModel;
  /** Raison de la fin (STOP, MAX_TOKENS, etc.) */
  finishReason?: string;
}

interface GeminiContentPart {
  text?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiContentPart[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function isGeminiConfigured(): boolean {
  const k = process.env.GEMINI_API_KEY;
  return Boolean(k && !k.includes("placeholder"));
}

/**
 * Envoie un message à Gemini et retourne sa réponse.
 *
 * Throw si GEMINI_API_KEY est absente — caller doit prévoir un fallback.
 */
export async function chatWithGemini(
  input: GeminiChatInput,
): Promise<GeminiChatOutput> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "GEMINI_API_KEY manquante. Crée une clé gratuite sur https://aistudio.google.com/apikey et ajoute-la à .env.local (ou Vercel env vars).",
    );
  }

  const apiKey = process.env.GEMINI_API_KEY!;
  const model: GeminiModel = input.model ?? "gemini-2.5-flash";

  // Construit l'historique au format Gemini (parts: [{text}])
  const contents: GeminiContent[] = (input.history ?? []).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
  // Ajoute le message courant en dernier
  contents.push({ role: "user", parts: [{ text: input.userMessage }] });

  const body: GeminiGenerateContentRequest = {
    contents,
    generationConfig: {
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxOutputTokens ?? 2048,
    },
  };

  if (input.systemPrompt) {
    body.systemInstruction = { parts: [{ text: input.systemPrompt }] };
  }

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Gemini API HTTP ${res.status}: ${errBody.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as GeminiGenerateContentResponse;

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? "";

  return {
    text,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    model,
    finishReason: data.candidates?.[0]?.finishReason,
  };
}

/**
 * Coût estimé en cents pour un appel Gemini.
 * Free tier = 0. Si on bascule en payant, c'est très bon marché :
 *   Gemini 2.5 Flash : $0.075/MTok input, $0.30/MTok output (mai 2026)
 *   Gemini 2.5 Flash-Lite : $0.04/MTok input, $0.10/MTok output
 *
 * En free tier on retourne toujours 0.
 */
export function estimateGeminiCostCents(
  tokensIn: number,
  tokensOut: number,
  model: GeminiModel = "gemini-2.5-flash",
): number {
  // Si free tier (pas de billing actif), tout est gratuit
  const inputPricePerMtok = model === "gemini-2.5-flash-lite" ? 4 : 7.5;
  const outputPricePerMtok = model === "gemini-2.5-flash-lite" ? 10 : 30;
  return Math.round(
    (tokensIn / 1_000_000) * inputPricePerMtok +
      (tokensOut / 1_000_000) * outputPricePerMtok,
  );
}
