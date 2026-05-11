"use server";

import { revalidatePath } from "next/cache";
import {
  importNumber,
  listAvailableNumbers,
  getNumberByPhone,
  releaseNumber,
  setNumberStatus,
  type WhatsAppNumberStatus,
} from "@/lib/db/whatsapp";
import { provisionAgentForClient } from "@/lib/whatsapp/number-manager";
import { sendWhatsAppMessage } from "@/lib/whatsapp/twilio-client";
import { createClient, setClientModuleEnabled } from "@/lib/db/store";
import { MODULE_REGISTRY } from "@/modules/registry";

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

/**
 * Setup MVP en 1 clic :
 * 1. (Optionnel) importe le numéro Sandbox Twilio s'il n'est pas déjà dans le pool
 * 2. Crée un client "Demo Test" (sauf s'il existe déjà → réutilise)
 * 3. Active TOUS les modules sur ce client
 * 4. Attribue un numéro libre du pool au client
 * 5. Optionnel : envoie le message d'onboarding sur le tel perso fourni
 *
 * Permet à Samuel de tester l'agent en quelques secondes sans configurer
 * un client réel + chaque module manuellement.
 */
export async function setupMvpAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  client?: { id: string; name: string };
  agentNumber?: string;
  modulesActivated?: string[];
  onboardingSent?: boolean;
}> {
  const importSandbox = formData.get("importSandbox") === "on";
  const userPhone = String(formData.get("userPhone") ?? "").trim() || undefined;
  const clientName =
    String(formData.get("clientName") ?? "").trim() || "Client Demo MVP";

  if (userPhone && !userPhone.match(/^\+\d{8,15}$/)) {
    return {
      ok: false,
      error: "Téléphone perso invalide. Format E.164 attendu (+33...).",
    };
  }

  try {
    // 1. Import du numéro Sandbox si demandé et pas déjà présent
    if (importSandbox) {
      const sandboxPhone = "+14155238886";
      const existing = await getNumberByPhone(sandboxPhone);
      if (!existing) {
        await importNumber({
          phoneNumber: sandboxPhone,
          notes: "Sandbox Twilio (importé via Setup MVP)",
          monthlyCostCents: 0,
        });
      }
    }

    // 2. Vérifier qu'il y a au moins un numéro libre
    const available = await listAvailableNumbers();
    if (available.length === 0) {
      return {
        ok: false,
        error:
          "Aucun numéro libre dans le pool. Importe un numéro ou coche 'Importer Sandbox' d'abord.",
      };
    }

    // 3. Créer un client de test
    const client = await createClient({
      name: clientName,
      contactEmail: "demo@agent-platform.local",
      contactPhone: userPhone,
      industry: "Test MVP — tous secteurs",
      notes: "Client créé via Setup MVP — utilisé pour tester l'agent en live",
    });

    // 4. Activer TOUS les modules sur ce client
    const modulesActivated: string[] = [];
    for (const m of MODULE_REGISTRY) {
      try {
        await setClientModuleEnabled(
          client.id,
          m.id,
          true,
          (m.defaultConfig ?? {}) as Record<string, unknown>,
        );
        modulesActivated.push(m.id);
      } catch (err) {
        console.error(
          `[setupMvp] module ${m.id} échec : ${(err as Error).message}`,
        );
      }
    }

    // 5. Attribuer un numéro + (optionnel) envoyer onboarding
    const result = await provisionAgentForClient({
      clientId: client.id,
      userPhone,
    });

    revalidatePath("/whatsapp");
    revalidatePath("/clients");

    return {
      ok: true,
      client: { id: client.id, name: client.name },
      agentNumber: result.number.phoneNumber,
      modulesActivated,
      onboardingSent: result.onboardingSent,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
