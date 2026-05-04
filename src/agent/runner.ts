import { randomUUID } from "node:crypto";
import { getModuleById } from "@/modules/registry";
import { listClientModules, getClient, ensureLoaded } from "@/lib/db/store";
import type { ModuleRunContext, ModuleRunResult } from "@/modules/types";
import { recordRun } from "@/lib/db/runs";

export interface RunModuleArgs {
  clientId: string;
  moduleId: string;
  payload: unknown;
  /** Pour le playground admin : exécute même si le module n'est pas activé pour ce client. */
  bypassEnabledCheck?: boolean;
}

export interface RunLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  data?: unknown;
  at: string;
}

export interface RunOutcome {
  runId: string;
  clientId: string;
  moduleId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  result: ModuleRunResult;
  logs: RunLogEntry[];
}

export async function runModuleForClient({
  clientId,
  moduleId,
  payload,
  bypassEnabledCheck,
}: RunModuleArgs): Promise<RunOutcome> {
  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) throw new Error(`Client introuvable : ${clientId}`);

  const mod = getModuleById(moduleId);
  if (!mod) throw new Error(`Module introuvable : ${moduleId}`);
  if (!mod.run) throw new Error(`Module ${moduleId} sans logique d'exécution.`);

  const cms = listClientModules(clientId);
  const cm = cms.find((x) => x.moduleId === moduleId);
  if (!bypassEnabledCheck && (!cm || !cm.enabled)) {
    throw new Error(`Module ${moduleId} non activé pour ${client.name}.`);
  }

  const runId = randomUUID();
  const logs: RunLogEntry[] = [];
  const startedAt = new Date();

  const log = (level: RunLogEntry["level"], message: string, data?: unknown) => {
    logs.push({ level, message, data, at: new Date().toISOString() });
  };

  log("info", `Démarrage du module ${mod.name} pour ${client.name}`);

  let result: ModuleRunResult;
  try {
    const config = cm?.config ?? mod.defaultConfig ?? {};
    const ctx: ModuleRunContext<unknown> = {
      clientId,
      moduleId,
      runId,
      moduleConfig: config,
      log,
      config,
      payload,
    };
    result = await mod.run(ctx);
  } catch (err) {
    log("error", "Exception pendant l'exécution", { message: (err as Error).message });
    result = {
      ok: false,
      summary: `Erreur : ${(err as Error).message}`,
      error: (err as Error).stack ?? (err as Error).message,
    };
  }

  const finishedAt = new Date();
  log(
    result.ok ? "info" : "error",
    `Fin du module : ${result.summary}`,
  );

  const outcome: RunOutcome = {
    runId,
    clientId,
    moduleId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    result,
    logs,
  };

  // Persistance (best-effort, n'échoue pas le run)
  await recordRun(outcome);

  return outcome;
}
