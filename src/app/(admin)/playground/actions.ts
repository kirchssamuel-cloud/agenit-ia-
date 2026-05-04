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
    return { ok: false, error: "Collez un contenu CSV pour tester" };
  }

  try {
    const outcome = await runModuleForClient({
      clientId,
      moduleId,
      payload: { fileContent },
    });
    return { ok: true, outcome };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
