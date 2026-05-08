import "server-only";
import { randomUUID } from "node:crypto";
import { TEST_BANK, getSuiteByDomain } from "@/data/test-bank";
import type { TestQuestion } from "@/data/test-bank/types";
import {
  appendTestResult,
  upsertDomainMetric,
} from "@/lib/db/test-bank-store";
import { evaluateResponse, EVALUATOR_MODEL_NAME } from "./evaluator";
import { detectAndStoreGap } from "./gap-detector";

/**
 * Test Runner — exécute une suite de tests sur l'agent et persiste les résultats.
 *
 * Pipeline par question :
 *   1. Demander la réponse à l'agent (chatWithAgent ou stub démo)
 *   2. Faire évaluer la réponse par Claude Opus (ou heuristique sans clé)
 *   3. Persister le résultat (test_results)
 *   4. Si échec → détecter et persister la lacune (agent_gaps)
 *
 * Pipeline global :
 *   - Lance toutes les questions du domaine
 *   - Calcule les agrégats (taux réussite, score moyen)
 *   - Upsert domain_metrics
 *
 * Mode démo : si pas d'ANTHROPIC_API_KEY, l'agent renvoie un stub neutre,
 * l'évaluation se fait en heuristique. Permet d'exercer toute la chaîne.
 */

export interface RunOptions {
  /** clientId pour passer à chatWithAgent (par défaut : 'test-client') */
  clientId?: string;
  /** Nombre max de questions par domaine (utile pour smoke tests) */
  limit?: number;
  /** Identifiant de run partagé entre tous les tests d'une suite */
  runId?: string;
}

export interface DomainRunResult {
  domain: string;
  runId: string;
  totalTests: number;
  passedTests: number;
  successRate: number;
  avgScore: number;
  totalCostCents: number;
  durationMs: number;
}

const STUB_AGENT_MODEL = "stub-no-anthropic";

/**
 * Demande la réponse de l'agent. Utilise chatWithAgent si clé Anthropic
 * disponible, sinon retourne un stub très court (pour exercer le pipeline
 * sans coût ni timeout).
 */
async function askAgent(
  question: TestQuestion,
  clientId: string,
): Promise<{ text: string; tokensIn: number; tokensOut: number; costCents: number; durationMs: number; agentModel: string }> {
  const t0 = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Stub : on retourne quelque chose qui contient AU MOINS un keyword pour
    // que l'évaluation heuristique soit non-zéro. Permet de voir le pipeline
    // tourner même sans clé.
    const keywords = [
      ...question.expectedKeywords.slice(0, 2),
      ...question.expectedConcepts.slice(0, 1),
    ].join(", ");
    return {
      text: `[Mode démo — pas de cerveau Claude] Réponse stub pour "${question.question.slice(0, 60)}...". Mots-clés mentionnés : ${keywords}.`,
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      durationMs: Date.now() - t0,
      agentModel: STUB_AGENT_MODEL,
    };
  }

  // Mode prod : vrai chatWithAgent
  try {
    const { chatWithAgent } = await import("@/agent/brain");
    const result = await chatWithAgent({
      clientId,
      userMessage: question.question,
      channel: "api",
    });
    return {
      text: result.assistantMessage,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costCents: result.costCents,
      durationMs: Date.now() - t0,
      agentModel: "claude-opus-4-7",
    };
  } catch (err) {
    return {
      text: `[Erreur agent] ${(err as Error).message}`,
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      durationMs: Date.now() - t0,
      agentModel: "error",
    };
  }
}

/**
 * Lance les tests d'un domaine donné.
 */
export async function runDomainSuite(
  domain: string,
  options: RunOptions = {},
): Promise<DomainRunResult> {
  const t0 = Date.now();
  const suite = getSuiteByDomain(domain);
  if (!suite) throw new Error(`Domaine inconnu : ${domain}`);

  const runId = options.runId ?? randomUUID();
  const clientId = options.clientId ?? "test-client";
  const questions = options.limit
    ? suite.questions.slice(0, options.limit)
    : suite.questions;

  let totalScore = 0;
  let passedCount = 0;
  let totalCostCents = 0;

  for (const question of questions) {
    // 1. Réponse agent
    const agentRes = await askAgent(question, clientId);

    // 2. Évaluation
    const evaluation = await evaluateResponse({
      question: question.question,
      agentResponse: agentRes.text,
      expectedConcepts: question.expectedConcepts,
      expectedKeywords: question.expectedKeywords,
    });

    const passed = evaluation.score >= question.minScore;
    if (passed) passedCount++;
    totalScore += evaluation.score;
    totalCostCents += agentRes.costCents + evaluation.costCents;

    // 3. Persister le résultat
    let testResultId: string | undefined;
    try {
      const persisted = await appendTestResult({
        questionId: question.id,
        runId,
        agentResponse: agentRes.text,
        evaluatorScore: evaluation.score,
        evaluatorFeedback: evaluation.feedback,
        missingConcepts: evaluation.missingConcepts,
        missingKeywords: evaluation.missingKeywords,
        passed,
        executionTimeMs: agentRes.durationMs,
        costCents: agentRes.costCents + evaluation.costCents,
        agentModel: agentRes.agentModel,
        evaluatorModel: evaluation.llmEvaluated
          ? EVALUATOR_MODEL_NAME
          : "heuristic",
      });
      testResultId = persisted.id;
    } catch (err) {
      console.error(
        `[test-runner] persist result échec : ${(err as Error).message}`,
      );
    }

    // 4. Si échec → détecter le gap
    if (!passed) {
      await detectAndStoreGap({
        question,
        agentResponse: agentRes.text,
        evaluation,
        testResultId,
      });
    }
  }

  // Agrégats domaine
  const totalTests = questions.length;
  const successRate = totalTests > 0 ? (passedCount / totalTests) * 100 : 0;
  const avgScore = totalTests > 0 ? totalScore / totalTests : 0;

  await upsertDomainMetric({
    domain,
    totalTests,
    passedTests: passedCount,
    avgScore,
  });

  return {
    domain,
    runId,
    totalTests,
    passedTests: passedCount,
    successRate,
    avgScore,
    totalCostCents,
    durationMs: Date.now() - t0,
  };
}

/**
 * Lance les tests sur TOUS les domaines (pour cron nightly).
 */
export async function runAllDomains(
  options: RunOptions = {},
): Promise<DomainRunResult[]> {
  const runId = options.runId ?? randomUUID();
  const results: DomainRunResult[] = [];

  for (const suite of TEST_BANK) {
    try {
      const r = await runDomainSuite(suite.domain, {
        ...options,
        runId,
      });
      results.push(r);
    } catch (err) {
      console.error(
        `[test-runner] domaine ${suite.domain} échec : ${(err as Error).message}`,
      );
      results.push({
        domain: suite.domain,
        runId,
        totalTests: 0,
        passedTests: 0,
        successRate: 0,
        avgScore: 0,
        totalCostCents: 0,
        durationMs: 0,
      });
    }
  }

  return results;
}
