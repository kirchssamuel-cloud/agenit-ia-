"use server";

import { revalidatePath } from "next/cache";
import {
  importNumber,
  releaseNumber,
  setNumberStatus,
  type WhatsAppNumberStatus,
} from "@/lib/db/whatsapp";
import { provisionAgentForClient } from "@/lib/whatsapp/number-manager";
import { sendWhatsAppMessage } from "@/lib/whatsapp/twilio-client";

/**
 * Server actions pour /admin/whatsapp.
 * Les calls DB passent par le DAO (avec bypass démo automatique).
 */

export async function importNumberAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const twilioSid = String(formData.get("twilioSid") ?? "").trim() || undefined;
  const monthlyCostStr = String(formData.get("monthlyCostCents") ?? "").trim();
  const monthlyCostCents =
    monthlyCostStr && Number.isFinite(Number(monthlyCostStr))
      ? Number(monthlyCostStr)
      : undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  if (!phoneNumber.match(/^\+\d{8,15}$/)) {
    return {
      ok: false,
      error: "Numéro invalide. Format E.164 attendu (ex: +33712345601).",
    };
  }
  try {
    await importNumber({ phoneNumber, twilioSid, monthlyCostCents, notes });
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function releaseNumberAction(numberId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await releaseNumber(numberId);
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function setStatusAction(
  numberId: string,
  status: WhatsAppNumberStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await setNumberStatus(numberId, status);
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Attribution manuelle depuis l'admin (cas exceptionnel : normalement
 * c'est le webhook checkout qui appelle provisionAgentForClient
 * automatiquement après paiement).
 */
export async function manualAssignAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  phoneNumber?: string;
}> {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const userPhone = String(formData.get("userPhone") ?? "").trim() || undefined;

  if (!clientId) return { ok: false, error: "clientId manquant" };

  try {
    const result = await provisionAgentForClient({ clientId, userPhone });
    revalidatePath("/whatsapp");
    revalidatePath("/clients");
    return { ok: true, phoneNumber: result.number.phoneNumber };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Test envoi : envoie un WhatsApp depuis le numéro pool vers le téléphone perso
 * pour vérifier que Twilio est bien branché.
 */
export async function sendTestMessageAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  sid?: string;
  realApiCall?: boolean;
}> {
  const fromPhone = String(formData.get("fromPhone") ?? "").trim();
  const toPhone = String(formData.get("toPhone") ?? "").trim();
  const body =
    String(formData.get("body") ?? "").trim() ||
    "Hello depuis ton agent IA 👋 Si tu lis ça, Twilio est correctement branché !";

  if (!fromPhone.match(/^\+\d{8,15}$/)) {
    return {
      ok: false,
      error: "Numéro source invalide. Format E.164 attendu (+33...).",
    };
  }
  if (!toPhone.match(/^\+\d{8,15}$/)) {
    return {
      ok: false,
      error: "Numéro destination invalide. Format E.164 attendu.",
    };
  }

  const result = await sendWhatsAppMessage({
    from: fromPhone,
    to: toPhone,
    body,
  });

  if (result.status === "failed") {
    return {
      ok: false,
      error: `${result.errorCode ?? "FAILED"}: ${result.errorMessage ?? "envoi échoué"}`,
      sid: result.sid,
      realApiCall: result.realApiCall,
    };
  }

  return {
    ok: true,
    sid: result.sid,
    realApiCall: result.realApiCall,
  };
}
