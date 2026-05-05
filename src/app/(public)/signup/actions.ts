"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/store";

export async function signupAction(formData: FormData) {
  const name = String(formData.get("company") ?? "").trim();
  const contactEmail = String(formData.get("email") ?? "").trim();
  const contactPhone = String(formData.get("phone") ?? "").trim() || undefined;
  const industry = String(formData.get("industry") ?? "").trim() || undefined;
  const fullName = String(formData.get("name") ?? "").trim();

  if (!name || !contactEmail) {
    return { error: "Nom de l'entreprise et email obligatoires" };
  }

  try {
    const client = await createClient({
      name,
      contactEmail,
      contactPhone,
      industry,
      notes: fullName ? `Contact : ${fullName}` : undefined,
    });
    redirect(`/choose-modules?clientId=${client.id}`);
  } catch (err) {
    if ((err as Error).message === "NEXT_REDIRECT") throw err;
    return { error: (err as Error).message };
  }
}
