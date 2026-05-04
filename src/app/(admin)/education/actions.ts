"use server";

import { revalidatePath } from "next/cache";
import {
  createSkill,
  deleteSkill,
  updateSkill,
  approveLearning,
  type SkillExample,
  type SkillStatus,
} from "@/lib/db/agent-skills";

export async function createSkillAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const triggerPattern = String(formData.get("triggerPattern") ?? "").trim() || undefined;
  const actionTemplate = String(formData.get("actionTemplate") ?? "").trim() || undefined;
  const moduleId = String(formData.get("moduleId") ?? "").trim() || undefined;
  const examplesRaw = String(formData.get("examples") ?? "").trim();

  if (!name) return { error: "Le nom est obligatoire" };

  let examples: SkillExample[] = [];
  if (examplesRaw) {
    try {
      const parsed = JSON.parse(examplesRaw);
      if (Array.isArray(parsed)) examples = parsed;
    } catch {
      return { error: "Examples : JSON invalide" };
    }
  }

  try {
    const s = await createSkill({
      name,
      description,
      triggerPattern,
      actionTemplate,
      examples,
      moduleId,
      status: "draft",
    });
    revalidatePath("/education");
    return { ok: true, id: s.id };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function updateSkillStatusAction(id: string, status: SkillStatus) {
  try {
    await updateSkill(id, { status });
    revalidatePath("/education");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function deleteSkillAction(id: string) {
  try {
    await deleteSkill(id);
    revalidatePath("/education");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function approveLearningAction(id: string) {
  try {
    await approveLearning(id);
    revalidatePath("/education");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
