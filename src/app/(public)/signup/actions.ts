"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/store";
import { normalizePhoneE164, InvalidPhoneError } from "@/lib/utils/phone";

export async function signupAction(formData: FormData) {
  const name = String(formData.get("company") ?? "").trim();
  const contactEmail = String(formData.get("email") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || undefined;
  const fullName = String(formData.get("name") ?? "").trim();

  if (!name || !contactEmail) {
    return { error: "Nom de l'entreprise et email obligatoires" };
  }

  // Phone obligatoire pour identifier le client dans le webhook WhatsApp
  // (mapping From → contactPhone → clientId). Sans phone normalisé, l'agent
  // ne peut pas savoir qui parle quand le numéro Twilio est partagé (sandbox).
  if (!rawPhone) {
    return {
      error:
        "Téléphone obligatoire — c'est le numéro où tu utilises WhatsApp, on s'en sert pour t'identifier.",
    };
  }

  let contactPhone: string;
  try {
    contactPhone = normalizePhoneE164(rawPhone);
  } catch (err) {
    if (err instanceof InvalidPhoneError) {
      return { error: err.message };
    }
    throw err;
  }

  try {
    const client = await createClient({
      name,
      contactEmail,
      contactPhone,
      industry,
      notes: fullName ? `Contact : ${fullName}` : undefined,
    });

    // Skip checkout pendant la phase test : on file direct sur l'onboarding
    // pour que Samuel + ses premiers testeurs puissent connecter Google et
    // tester l'agent sans avoir à passer un vrai paiement Stripe.
    // Le code checkout reste accessible via /choose-modules pour quand on
    // sera prêt à monétiser.
    redirect(`/onboarding?clientId=${client.id}`);
  } catch (err) {
    if ((err as Error).message === "NEXT_REDIRECT") throw err;
    return { error: (err as Error).message };
  }
}
