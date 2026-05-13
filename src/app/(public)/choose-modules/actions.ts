"use server";

import { redirect } from "next/navigation";
import { setClientModuleEnabled } from "@/lib/db/store";
import { getModuleById } from "@/modules/registry";

/**
 * Détection robuste d'un RedirectError Next.js. En Next 15+, `redirect()`
 * throw une Error dont la propriété `.digest` commence par
 * `NEXT_REDIRECT;...`. Le `.message` peut être vide. Ne pas matcher sur
 * `.message === "NEXT_REDIRECT"` (faille silencieuse).
 */
function isRedirectErrorLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { digest?: unknown; message?: unknown };
  if (typeof e.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) {
    return true;
  }
  if (e.message === "NEXT_REDIRECT") return true;
  return false;
}

export async function activateModulesAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const moduleIds = String(formData.get("moduleIds") ?? "")
    .split(",")
    .filter(Boolean);

  if (!clientId) return { error: "clientId manquant" };
  if (moduleIds.length === 0)
    return { error: "Sélectionne au moins un module" };

  // Active les modules best-effort, track les succès pour ne pas avancer
  // si tous ont échoué (état zombi en aval).
  let activated = 0;
  let lastError: string | undefined;
  for (const mid of moduleIds) {
    const mod = getModuleById(mid);
    if (!mod) continue;
    try {
      await setClientModuleEnabled(
        clientId,
        mid,
        true,
        (mod.defaultConfig ?? {}) as Record<string, unknown>,
      );
      activated++;
    } catch (err) {
      lastError = (err as Error).message;
      console.error(`[activate-modules] ${mid} échec : ${lastError}`);
    }
  }

  if (activated === 0) {
    return {
      error: `Impossible d'activer les modules. ${lastError ?? "Réessaie."}`,
    };
  }

  try {
    redirect(`/checkout?clientId=${clientId}&modules=${moduleIds.join(",")}`);
  } catch (err) {
    if (isRedirectErrorLike(err)) throw err;
    return { error: (err as Error).message };
  }
}
