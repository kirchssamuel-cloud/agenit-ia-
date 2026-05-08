"use server";

import { revalidatePath } from "next/cache";
import {
  setInstruction,
  clearInstruction,
} from "@/lib/db/skill-instructions";

export async function saveInstructionAction(
  skillId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!skillId) return { ok: false, error: "skillId manquant" };
  try {
    await setInstruction(skillId, text);
    revalidatePath("/tools");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function resetInstructionAction(
  skillId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!skillId) return { ok: false, error: "skillId manquant" };
  try {
    await clearInstruction(skillId);
    revalidatePath("/tools");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
