import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * DAO pour le système d'évaluation.
 *
 * 4 tables côté Supabase :
 *  - test_questions    (banque de questions)
 *  - test_results      (chaque exécution + score)
 *  - agent_gaps        (lacunes détectées)
 *  - domain_metrics    (agrégats par domaine)
 *
 * Mode démo : si Supabase placeholder, on stocke en RAM (volatile).
 * Permet à toute la chaîne de fonctionner sans DB configurée.
 */

// ============================================================
// Types
// ============================================================

export type GapType =
  | "missing_vocab"
  | "missing_concept"
  | "wrong_method"
  | "incorrect_fact"
  | "tone_mismatch"
  | "unknown";

export type GapStatus = "open" | "fixed" | "wontfix" | "in_progress";

export type DomainTrend = "improving" | "stable" | "declining" | null;

export interface TestResult {
  id: string;
  questionId: string;
  runId: string | null;
  agentResponse: string;
  evaluatorScore: number | null;
  evaluatorFeedback: string | null;
  missingConcepts: string[];
  missingKeywords: string[];
  passed: boolean;
  executionTimeMs: number | null;
  costCents: number | null;
  agentModel: string | null;
  evaluatorModel: string | null;
  testedAt: string;
}

export interface AgentGap {
  id: string;
  domain: string;
  gapType: GapType;
  description: string;
  exampleQuestionId: string | null;
  exampleTestResultId: string | null;
  occurrenceCount: number;
  status: GapStatus;
  suggestedFix: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainMetric {
  domain: string;
  totalTests: number;
  passedTests: number;
  successRate: number;
  avgScore: number;
  openGapsCount: number;
  lastTested: string | null;
  previousAvgScore: number | null;
  trend: DomainTrend;
  updatedAt: string;
}

// ============================================================
// Mode démo (RAM)
// ============================================================

function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return (
    process.env.DEMO_MODE === "true" ||
    url.includes("placeholder") ||
    key.includes("placeholder") ||
    url === "" ||
    key === ""
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __testBankDemo:
    | {
        results: TestResult[];
        gaps: AgentGap[];
        metrics: Map<string, DomainMetric>;
      }
    | undefined;
}

function getDemoStore() {
  if (!globalThis.__testBankDemo) {
    globalThis.__testBankDemo = {
      results: [],
      gaps: [],
      metrics: new Map(),
    };
  }
  return globalThis.__testBankDemo;
}

// Mappers
interface ResultRow {
  id: string;
  question_id: string;
  run_id: string | null;
  agent_response: string;
  evaluator_score: number | null;
  evaluator_feedback: string | null;
  missing_concepts: string[];
  missing_keywords: string[];
  passed: boolean;
  execution_time_ms: number | null;
  cost_cents: number | null;
  agent_model: string | null;
  evaluator_model: string | null;
  tested_at: string;
}

interface GapRow {
  id: string;
  domain: string;
  gap_type: GapType;
  description: string;
  example_question_id: string | null;
  example_test_result_id: string | null;
  occurrence_count: number;
  status: GapStatus;
  suggested_fix: string | null;
  created_at: string;
  updated_at: string;
}

interface MetricRow {
  domain: string;
  total_tests: number;
  passed_tests: number;
  success_rate: number;
  avg_score: number;
  open_gaps_count: number;
  last_tested: string | null;
  previous_avg_score: number | null;
  trend: DomainTrend;
  updated_at: string;
}

function rowToResult(r: ResultRow): TestResult {
  return {
    id: r.id,
    questionId: r.question_id,
    runId: r.run_id,
    agentResponse: r.agent_response,
    evaluatorScore: r.evaluator_score,
    evaluatorFeedback: r.evaluator_feedback,
    missingConcepts: r.missing_concepts ?? [],
    missingKeywords: r.missing_keywords ?? [],
    passed: r.passed,
    executionTimeMs: r.execution_time_ms,
    costCents: r.cost_cents,
    agentModel: r.agent_model,
    evaluatorModel: r.evaluator_model,
    testedAt: r.tested_at,
  };
}

function rowToGap(r: GapRow): AgentGap {
  return {
    id: r.id,
    domain: r.domain,
    gapType: r.gap_type,
    description: r.description,
    exampleQuestionId: r.example_question_id,
    exampleTestResultId: r.example_test_result_id,
    occurrenceCount: r.occurrence_count,
    status: r.status,
    suggestedFix: r.suggested_fix,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToMetric(r: MetricRow): DomainMetric {
  return {
    domain: r.domain,
    totalTests: r.total_tests,
    passedTests: r.passed_tests,
    successRate: Number(r.success_rate),
    avgScore: Number(r.avg_score),
    openGapsCount: r.open_gaps_count,
    lastTested: r.last_tested,
    previousAvgScore:
      r.previous_avg_score === null ? null : Number(r.previous_avg_score),
    trend: r.trend,
    updatedAt: r.updated_at,
  };
}

// ============================================================
// Test results
// ============================================================

export async function appendTestResult(input: {
  questionId: string;
  runId?: string;
  agentResponse: string;
  evaluatorScore: number;
  evaluatorFeedback?: string;
  missingConcepts?: string[];
  missingKeywords?: string[];
  passed: boolean;
  executionTimeMs?: number;
  costCents?: number;
  agentModel?: string;
  evaluatorModel?: string;
}): Promise<TestResult> {
  if (isDemoMode()) {
    const created: TestResult = {
      id: `tr-${Math.random().toString(36).slice(2, 12)}`,
      questionId: input.questionId,
      runId: input.runId ?? null,
      agentResponse: input.agentResponse,
      evaluatorScore: input.evaluatorScore,
      evaluatorFeedback: input.evaluatorFeedback ?? null,
      missingConcepts: input.missingConcepts ?? [],
      missingKeywords: input.missingKeywords ?? [],
      passed: input.passed,
      executionTimeMs: input.executionTimeMs ?? null,
      costCents: input.costCents ?? null,
      agentModel: input.agentModel ?? null,
      evaluatorModel: input.evaluatorModel ?? null,
      testedAt: new Date().toISOString(),
    };
    getDemoStore().results.push(created);
    return created;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("test_results")
    .insert({
      question_id: input.questionId,
      run_id: input.runId ?? null,
      agent_response: input.agentResponse,
      evaluator_score: input.evaluatorScore,
      evaluator_feedback: input.evaluatorFeedback ?? null,
      missing_concepts: input.missingConcepts ?? [],
      missing_keywords: input.missingKeywords ?? [],
      passed: input.passed,
      execution_time_ms: input.executionTimeMs ?? null,
      cost_cents: input.costCents ?? null,
      agent_model: input.agentModel ?? null,
      evaluator_model: input.evaluatorModel ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`appendTestResult: ${error?.message}`);
  return rowToResult(data as ResultRow);
}

export async function listResultsForRun(runId: string): Promise<TestResult[]> {
  if (isDemoMode()) {
    return getDemoStore().results.filter((r) => r.runId === runId);
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("test_results")
    .select("*")
    .eq("run_id", runId);
  if (error) throw new Error(`listResultsForRun: ${error.message}`);
  return (data ?? []).map((r) => rowToResult(r as ResultRow));
}

export async function listRecentResults(
  limit = 100,
): Promise<TestResult[]> {
  if (isDemoMode()) {
    return [...getDemoStore().results]
      .sort((a, b) => b.testedAt.localeCompare(a.testedAt))
      .slice(0, limit);
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("test_results")
    .select("*")
    .order("tested_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentResults: ${error.message}`);
  return (data ?? []).map((r) => rowToResult(r as ResultRow));
}

// ============================================================
// Gaps
// ============================================================

export async function appendGap(input: {
  domain: string;
  gapType: GapType;
  description: string;
  exampleQuestionId?: string;
  exampleTestResultId?: string;
  suggestedFix?: string;
}): Promise<AgentGap> {
  if (isDemoMode()) {
    const created: AgentGap = {
      id: `gap-${Math.random().toString(36).slice(2, 12)}`,
      domain: input.domain,
      gapType: input.gapType,
      description: input.description,
      exampleQuestionId: input.exampleQuestionId ?? null,
      exampleTestResultId: input.exampleTestResultId ?? null,
      occurrenceCount: 1,
      status: "open",
      suggestedFix: input.suggestedFix ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getDemoStore().gaps.push(created);
    return created;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_gaps")
    .insert({
      domain: input.domain,
      gap_type: input.gapType,
      description: input.description,
      example_question_id: input.exampleQuestionId ?? null,
      example_test_result_id: input.exampleTestResultId ?? null,
      suggested_fix: input.suggestedFix ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`appendGap: ${error?.message}`);
  return rowToGap(data as GapRow);
}

export async function listOpenGaps(domain?: string): Promise<AgentGap[]> {
  if (isDemoMode()) {
    let gaps = getDemoStore().gaps.filter((g) => g.status === "open");
    if (domain) gaps = gaps.filter((g) => g.domain === domain);
    return gaps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const sb = createSupabaseAdminClient();
  let q = sb.from("agent_gaps").select("*").eq("status", "open");
  if (domain) q = q.eq("domain", domain);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`listOpenGaps: ${error.message}`);
  return (data ?? []).map((r) => rowToGap(r as GapRow));
}

export async function setGapStatus(
  gapId: string,
  status: GapStatus,
): Promise<void> {
  if (isDemoMode()) {
    const g = getDemoStore().gaps.find((x) => x.id === gapId);
    if (g) {
      g.status = status;
      g.updatedAt = new Date().toISOString();
    }
    return;
  }
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("agent_gaps")
    .update({ status })
    .eq("id", gapId);
  if (error) throw new Error(`setGapStatus: ${error.message}`);
}

// ============================================================
// Domain metrics
// ============================================================

export async function upsertDomainMetric(input: {
  domain: string;
  totalTests: number;
  passedTests: number;
  avgScore: number;
}): Promise<DomainMetric> {
  const successRate =
    input.totalTests > 0 ? (input.passedTests / input.totalTests) * 100 : 0;

  if (isDemoMode()) {
    const store = getDemoStore();
    const previous = store.metrics.get(input.domain);
    const trend: DomainTrend = previous?.avgScore
      ? input.avgScore > previous.avgScore + 0.3
        ? "improving"
        : input.avgScore < previous.avgScore - 0.3
          ? "declining"
          : "stable"
      : null;
    const openGaps = store.gaps.filter(
      (g) => g.domain === input.domain && g.status === "open",
    ).length;
    const next: DomainMetric = {
      domain: input.domain,
      totalTests: input.totalTests,
      passedTests: input.passedTests,
      successRate,
      avgScore: input.avgScore,
      openGapsCount: openGaps,
      lastTested: new Date().toISOString(),
      previousAvgScore: previous?.avgScore ?? null,
      trend,
      updatedAt: new Date().toISOString(),
    };
    store.metrics.set(input.domain, next);
    return next;
  }

  const sb = createSupabaseAdminClient();
  // Charger l'ancienne valeur pour calculer le trend
  const { data: prev } = await sb
    .from("domain_metrics")
    .select("avg_score")
    .eq("domain", input.domain)
    .maybeSingle();
  const previousAvg = prev?.avg_score ? Number(prev.avg_score) : null;
  const trend: DomainTrend =
    previousAvg !== null
      ? input.avgScore > previousAvg + 0.3
        ? "improving"
        : input.avgScore < previousAvg - 0.3
          ? "declining"
          : "stable"
      : null;

  const { count } = await sb
    .from("agent_gaps")
    .select("id", { count: "exact", head: true })
    .eq("domain", input.domain)
    .eq("status", "open");

  const { data, error } = await sb
    .from("domain_metrics")
    .upsert({
      domain: input.domain,
      total_tests: input.totalTests,
      passed_tests: input.passedTests,
      success_rate: successRate,
      avg_score: input.avgScore,
      open_gaps_count: count ?? 0,
      last_tested: new Date().toISOString(),
      previous_avg_score: previousAvg,
      trend,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`upsertDomainMetric: ${error?.message}`);
  return rowToMetric(data as MetricRow);
}

export async function listDomainMetrics(): Promise<DomainMetric[]> {
  if (isDemoMode()) {
    return [...getDemoStore().metrics.values()].sort((a, b) =>
      a.domain.localeCompare(b.domain),
    );
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("domain_metrics")
    .select("*")
    .order("domain", { ascending: true });
  if (error) throw new Error(`listDomainMetrics: ${error.message}`);
  return (data ?? []).map((r) => rowToMetric(r as MetricRow));
}
