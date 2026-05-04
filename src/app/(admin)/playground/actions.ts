"use server";

import { runModuleForClient, type RunOutcome } from "@/agent/runner";

export type PlaygroundResult =
  | { ok: true; outcome: RunOutcome }
  | { ok: false; error: string };

export async function runPlaygroundAction(formData: FormData): Promise<PlaygroundResult> {
  const clientId = String(formData.get("clientId") ?? "");
  const moduleId = String(formData.get("moduleId") ?? "");
  const fileContent = String(formData.get("fileContent") ?? "");

  if (!clientId || !moduleId) {
    return { ok: false, error: "clientId et moduleId requis" };
  }
  if (!fileContent.trim()) {
    return { ok: false, error: "Donne un input pour tester" };
  }

  // Construit le payload selon le module
  let payload: unknown;
  if (moduleId === "lead-cleaning") {
    payload = { fileContent };
  } else if (moduleId === "tour-planning") {
    try {
      payload = JSON.parse(fileContent);
    } catch (err) {
      return { ok: false, error: `JSON invalide : ${(err as Error).message}` };
    }
  } else {
    payload = { fileContent };
  }

  try {
    const outcome = await runModuleForClient({
      clientId,
      moduleId,
      payload,
      bypassEnabledCheck: true,
    });
    return { ok: true, outcome };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
