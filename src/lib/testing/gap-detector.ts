import "server-only";
import { appendGap, type GapType } from "@/lib/db/test-bank-store";
import type { EvaluationResult } from "./evaluator";
import type { TestQuestion } from "@/data/test-bank/types";

/**
 * Gap Detector — analyse une évaluation ratée et stocke un gap typé.
 *
 * Logique :
 * - Si keywords manquants > 0 → 'missing_vocab'
 * - Sinon si concepts manquants > 0 → 'missing_concept'
 * - Sinon si score < 5 → 'wrong_method'
 * - Sinon si score < 7 → 'tone_mismatch' (la réponse a tout mais reste faible)
 *
 * Le gap stocké est ensuite consultable dans /admin/testing → onglet Lacunes,
 * et peut être traité par knowledge-enricher.ts (Phase 4 — auto-fix).
 */

export async function detectAndStoreGap(input: {
  question: TestQuestion;
  agentResponse: string;
  evaluation: EvaluationResult;
  testResultId?: string;
}): Promise<void> {
  const { question, evaluation } = input;

  // Si la réponse a passé le seuil min, pas de gap.
  if (evaluation.score >= question.minScore) return;

  let gapType: GapType = "unknown";
  let description = "";

  if (evaluation.missingKeywords.length > 0) {
    gapType = "missing_vocab";
    description = `Vocabulaire technique manquant : ${evaluation.missingKeywords.join(", ")}`;
  } else if (evaluation.missingConcepts.length > 0) {
    gapType = "missing_concept";
    description = `Concepts non couverts : ${evaluation.missingConcepts.join(", ")}`;
  } else if (evaluation.score < 5) {
    gapType = "wrong_method";
    description = `Approche incorrecte sur "${question.question.slice(0, 80)}...". Score ${evaluation.score}/10.`;
  } else {
    gapType = "tone_mismatch";
    description = `Réponse complète mais qualité insuffisante (${evaluation.score}/10). Feedback : ${evaluation.feedback.slice(0, 120)}`;
  }

  await appendGap({
    domain: question.domain,
    gapType,
    description,
    exampleQuestionId: question.id,
    exampleTestResultId: input.testResultId,
  }).catch((err) => {
    console.error(`[gap-detector] persist échec : ${(err as Error).message}`);
  });
}
