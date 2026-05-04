import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RunOutcome, RunLogEntry } from "@/agent/runner";

export type RunStatus = "pending" | "running" | "success" | "error";

export interface ModuleRunRecord {
  id: string;
  clientId: string;
  moduleId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  summary: string | null;
  errorMessage: string | null;
  logs: RunLogEntry[];
  data: Record<string, unknown> | null;
}

interface ModuleRunRow {
  id: string;
  client_id: string;
  module_id: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error_message: string | null;
}

function rowToRecord(r: ModuleRunRow): ModuleRunRecord {
  const output = (r.output ?? {}) as {
    summary?: string;
    durationMs?: number;
    logs?: RunLogEntry[];
    data?: Record<string, unknown>;
  };
  return {
    id: r.id,
    clientId: r.client_id,
    moduleId: r.module_id,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: output.durationMs ?? null,
    summary: output.summary ?? null,
    errorMessage: r.error_message,
    logs: output.logs ?? [],
    data: output.data ?? null,
  };
}

export async function recordRun(outcome: RunOutcome): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("module_runs").insert({
    id: outcome.runId,
    client_id: outcome.clientId,
    module_id: outcome.moduleId,
    status: outcome.result.ok ? "success" : "error",
    started_at: outcome.startedAt,
    finished_at: outcome.finishedAt,
    output: {
      summary: outcome.result.summary,
      durationMs: outcome.durationMs,
      logs: outcome.logs,
      data: outcome.result.data ?? null,
    },
    error_message: outcome.result.error ?? null,
  });
  if (error) {
    // Ne pas faire planter le run pour un échec de logging.
    console.error("recordRun:", error.message);
  }
}

export async function listRunsForClient(
  clientId: string,
  limit = 30,
): Promise<ModuleRunRecord[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("module_runs")
    .select("*")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRunsForClient: ${error.message}`);
  return (data ?? []).map((r) => rowToRecord(r as ModuleRunRow));
}

export async function listRecentRuns(limit = 50): Promise<ModuleRunRecord[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("module_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentRuns: ${error.message}`);
  return (data ?? []).map((r) => rowToRecord(r as ModuleRunRow));
}

export async function countRunsByStatus(
  clientId: string,
): Promise<Record<RunStatus, number>> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("module_runs")
    .select("status")
    .eq("client_id", clientId);
  if (error) throw new Error(`countRunsByStatus: ${error.message}`);
  const counts: Record<RunStatus, number> = {
    pending: 0,
    running: 0,
    success: 0,
    error: 0,
  };
  for (const r of data ?? []) counts[(r as { status: RunStatus }).status]++;
  return counts;
}
