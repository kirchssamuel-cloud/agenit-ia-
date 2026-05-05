"use server";

import { redirect } from "next/navigation";
import { setClientModuleEnabled } from "@/lib/db/store";
import { getModuleById } from "@/modules/registry";

export async function activateModulesAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const moduleIds = String(formData.get("moduleIds") ?? "")
    .split(",")
    .filter(Boolean);

  if (!clientId) return { error: "clientId manquant" };
  if (moduleIds.length === 0)
    return { error: "Sélectionne au moins un module" };

  try {
    for (const mid of moduleIds) {
      const mod = getModuleById(mid);
      if (!mod) continue;
      await setClientModuleEnabled(
        clientId,
        mid,
        true,
        (mod.defaultConfig ?? {}) as Record<string, unknown>,
      );
    }
    redirect(`/checkout?clientId=${clientId}&modules=${moduleIds.join(",")}`);
  } catch (err) {
    if ((err as Error).message === "NEXT_REDIRECT") throw err;
    return { error: (err as Error).message };
  }
}
