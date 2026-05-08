import "server-only";

/**
 * Module embeddings — vectorise du texte pour la mémoire sémantique de l'agent.
 *
 * Provider par défaut : OpenAI text-embedding-3-small (1536 dimensions).
 * Si OPENAI_API_KEY n'est pas configurée, retourne null sans crasher
 * (mode démo dégradé : la mémoire fonctionnera en mode "texte" sans recherche sémantique).
 *
 * On ne dépend pas du SDK openai (un fetch direct suffit) pour éviter d'alourdir
 * le bundle. La dimension 1536 est en dur car alignée sur la migration SQL
 * (vector(1536) dans client_memory).
 */

export const EMBEDDING_DIMENSION = 1536;
export const EMBEDDING_MODEL = "text-embedding-3-small";

let warned = false;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * Vectorise un texte. Retourne null si pas de clé API ou erreur (sans crasher).
 *
 * @param text Le texte à embedder. Sera tronqué à ~8000 chars pour respecter
 *             la limite de 8191 tokens de text-embedding-3-small.
 */
export async function embed(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (!warned) {
      console.warn(
        "[embeddings] OPENAI_API_KEY absent → mode dégradé (pas de recherche sémantique). " +
          "Crée une clé sur https://platform.openai.com/api-keys",
      );
      warned = true;
    }
    return null;
  }

  // Tronquer pour rester sous la limite de tokens (très approximatif).
  const safeText = text.slice(0, 8_000);

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: safeText,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[embeddings] OpenAI error ${res.status}: ${body.slice(0, 200)}`,
      );
      return null;
    }

    const json = (await res.json()) as OpenAIEmbeddingResponse;
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSION) {
      console.error(
        `[embeddings] dimension inattendue : ${vec?.length} (attendu ${EMBEDDING_DIMENSION})`,
      );
      return null;
    }
    return vec;
  } catch (err) {
    console.error(`[embeddings] échec : ${(err as Error).message}`);
    return null;
  }
}

/**
 * Vectorise plusieurs textes en une seule requête (batch, plus économique).
 * Retourne un tableau de la même longueur que l'input ; chaque élément peut
 * être null si l'embedding a échoué.
 */
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || texts.length === 0) {
    return texts.map(() => null);
  }

  const safeTexts = texts.map((t) => t.slice(0, 8_000));

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: safeTexts,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[embeddings] OpenAI batch error ${res.status}: ${body.slice(0, 200)}`,
      );
      return texts.map(() => null);
    }

    const json = (await res.json()) as OpenAIEmbeddingResponse;
    return safeTexts.map((_, i) => {
      const v = json.data?.[i]?.embedding;
      return Array.isArray(v) && v.length === EMBEDDING_DIMENSION ? v : null;
    });
  } catch (err) {
    console.error(`[embeddings] batch échec : ${(err as Error).message}`);
    return texts.map(() => null);
  }
}
