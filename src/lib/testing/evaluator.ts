import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Evaluator — Claude Opus juge la qualité de la réponse de l'agent.
 *
 * Pour chaque question testée :
 * 1. La question + réponse + concepts/keywords attendus sont passés à Opus
 * 2. Opus retourne un JSON strict { score, feedback, missing_concepts, missing_keywords }
 * 3. Le test runner décide passé/échec selon question.minScore
 *
 * Mode démo : si pas d'ANTHROPIC_API_KEY, on utilise un évaluateur heuristique
 * (matching simple keywords/concepts) qui permet de tester le pipeline.
 */

const EVALUATOR_MODEL = "claude-opus-4-7";
const EVALUATOR_MAX_TOKENS = 1200;

const EVALUATOR_SYSTEM = `Tu es un évaluateur expert qui juge la qualité des réponses d'un agent IA spécialisé métier.

Tu reçois :
- La question posée
- La réponse de l'agent
- Les concepts attendus (sémantique)
- Les mots-clés techniques attendus (vocabulaire métier)

Tu évalues sur 5 critères, note unique sur 10 :
1. Pertinence (la réponse colle à la question)
2. Précision technique (concepts corrects et factuels)
3. Vocabulaire métier (mots-clés présents et utilisés correctement)
4. Complétude (rien d'important manquant)
5. Clarté (bien expliqué pour un pro du domaine)

Tu réponds UNIQUEMENT en JSON strict, sans markdown, sans texte autour :

{
  "score": 0.0 à 10.0,
  "feedback": "phrase courte expliquant la note (ce qui va, ce qui manque)",
  "missing_concepts": ["concept1", "concept2"],
  "missing_keywords": ["keyword1", "keyword2"]
}

Sois juste mais exigeant. Note sévèrement si :
- Réponse hors-sujet ou évasive : ≤ 4
- Concepts présents mais vocabulaire absent : 5-6
- Technique correct mais incomplet : 6-7
- Qualité pro avec quelques manques : 7-8
- Excellente réponse complète : 9-10`;

export interface EvaluationInput {
  question: string;
  agentResponse: string;
  expectedConcepts: string[];
  expectedKeywords: string[];
}

export interface EvaluationResult {
  score: number;
  feedback: string;
  missingConcepts: string[];
  missingKeywords: string[];
  /** Coût en cents de cette évaluation */
  costCents: number;
  tokensIn: number;
  tokensOut: number;
  /** True si l'évaluation provient de Claude, false si fallback heuristique */
  llmEvaluated: boolean;
}

interface EvaluatorJSONResponse {
  score?: number;
  feedback?: string;
  missing_concepts?: string[];
  missing_keywords?: string[];
}

function parseJson(text: string): EvaluatorJSONResponse | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as EvaluatorJSONResponse;
  } catch {
    return null;
  }
}

/**
 * Évaluation heuristique (fallback sans clé Anthropic).
 * Compte le pourcentage de concepts/keywords présents dans la réponse,
 * pondère et donne une note approximative.
 */
function heuristicEvaluate(input: EvaluationInput): EvaluationResult {
  const lowerResponse = input.agentResponse.toLowerCase();

  const missingConcepts = input.expectedConcepts.filter(
    (c) => !lowerResponse.includes(c.toLowerCase()),
  );
  const missingKeywords = input.expectedKeywords.filter(
    (k) => !lowerResponse.includes(k.toLowerCase()),
  );

  const conceptCoverage =
    input.expectedConcepts.length > 0
      ? 1 - missingConcepts.length / input.expectedConcepts.length
      : 0.7;
  const keywordCoverage =
    input.expectedKeywords.length > 0
      ? 1 - missingKeywords.length / input.expectedKeywords.length
      : 0.7;

  // Score = mix concept (60%) + keyword (40%) sur 10
  const score = Math.round((conceptCoverage * 0.6 + keywordCoverage * 0.4) * 100) / 10;

  const feedback =
    score >= 8
      ? "Bonne réponse globale (évaluation heuristique sans LLM)."
      : score >= 5
        ? "Réponse partielle — certains concepts ou mots-clés manquent."
        : "Réponse insuffisante (évaluation heuristique).";

  return {
    score,
    feedback,
    missingConcepts,
    missingKeywords,
    costCents: 0,
    tokensIn: 0,
    tokensOut: 0,
    llmEvaluated: false,
  };
}

/**
 * Évalue la réponse de l'agent. Utilise Claude Opus si clé dispo,
 * sinon fallback heuristique.
 */
export async function evaluateResponse(
  input: EvaluationInput,
): Promise<EvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return heuristicEvaluate(input);
  }

  const userPrompt = [
    "# Question posée à l'agent",
    input.question,
    "",
    "# Réponse de l'agent à évaluer",
    input.agentResponse,
    "",
    "# Concepts attendus",
    input.expectedConcepts.map((c) => `- ${c}`).join("\n"),
    "",
    "# Mots-clés techniques attendus",
    input.expectedKeywords.map((k) => `- ${k}`).join("\n"),
    "",
    "Évalue selon le format JSON strict.",
  ].join("\n");

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: EVALUATOR_MODEL,
      max_tokens: EVALUATOR_MAX_TOKENS,
      system: [
        {
          type: "text",
          text: EVALUATOR_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const parsed = parseJson(textBlock?.text ?? "");

    // Coût Opus 4.7 : ~$5/M input, $25/M output
    const costCents = Math.round(
      (response.usage.input_tokens / 1_000_000) * 500 +
        (response.usage.output_tokens / 1_000_000) * 2_500,
    );

    if (!parsed || typeof parsed.score !== "number") {
      // Réponse inexploitable → fallback heuristique
      const fallback = heuristicEvaluate(input);
      return { ...fallback, costCents, tokensIn: response.usage.input_tokens, tokensOut: response.usage.output_tokens };
    }

    return {
      score: Math.max(0, Math.min(10, parsed.score)),
      feedback: parsed.feedback ?? "(pas de feedback)",
      missingConcepts: parsed.missing_concepts ?? [],
      missingKeywords: parsed.missing_keywords ?? [],
      costCents,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      llmEvaluated: true,
    };
  } catch (err) {
    console.error(`[evaluator] Claude échec, fallback heuristique : ${(err as Error).message}`);
    return heuristicEvaluate(input);
  }
}

export const EVALUATOR_MODEL_NAME = EVALUATOR_MODEL;
