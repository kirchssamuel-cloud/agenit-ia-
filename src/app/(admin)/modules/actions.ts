"use server";

import { revalidatePath } from "next/cache";
import { setOverride, clearOverride } from "@/lib/db/module-overrides";

/**
 * Sauvegarde le prix mensuel personnalisé d'un module.
 * Si la valeur est vide ou identique au défaut, on retire l'override.
 */
export async function saveModulePriceAction(
  moduleId: string,
  rawPrice: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = rawPrice.trim();
  if (trimmed === "") {
    return { ok: false, error: "Le prix ne peut pas être vide." };
  }
  const price = Number(trimmed);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Prix invalide." };
  }
  try {
    await setOverride(moduleId, { monthlyEUR: price });
    revalidatePath("/modules");
    revalidatePath("/choose-modules");
    revalidatePath("/landing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Active ou désactive la visibilité d'un module pour les clients.
 * Désactivé → n'apparaît plus dans /choose-modules ni la landing.
 */
export async function toggleModuleEnabledAction(
  moduleId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await setOverride(moduleId, { enabled });
    revalidatePath("/modules");
    revalidatePath("/choose-modules");
    revalidatePath("/landing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Reset complet de l'override (prix et toggle reviennent aux valeurs du registry).
 */
export async function resetModuleOverrideAction(
  moduleId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await clearOverride(moduleId);
    revalidatePath("/modules");
    revalidatePath("/choose-modules");
    revalidatePath("/landing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
