"use server";

import { revalidatePath } from "next/cache";
import {
  createClient as dbCreateClient,
  deleteClient as dbDeleteClient,
  setClientModuleEnabled,
} from "@/lib/db/store";
import { getModuleById } from "@/modules/registry";

export async function createClientAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim() || undefined;
  const industry = String(formData.get("industry") ?? "").trim() || undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  if (!name || !contactEmail) {
    return { error: "Nom et email obligatoires" };
  }
  try {
    const c = await dbCreateClient({ name, contactEmail, contactPhone, industry, notes });
    revalidatePath("/clients");
    return { ok: true, id: c.id };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function deleteClientAction(id: string) {
  try {
    await dbDeleteClient(id);
    revalidatePath("/clients");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function toggleClientModuleAction(
  clientId: string,
  moduleId: string,
  enabled: boolean,
) {
  const mod = getModuleById(moduleId);
  if (!mod) return { error: "Module inconnu" };
  try {
    await setClientModuleEnabled(
      clientId,
      moduleId,
      enabled,
      (mod.defaultConfig ?? {}) as Record<string, unknown>,
    );
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/modules");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
