"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ensureLoaded,
  getClient,
  setClientModuleEnabled,
} from "@/lib/db/store";
import { provisionAgentForClient } from "@/lib/whatsapp/number-manager";
import {
  importNumber,
  getNumberByPhone,
  releaseNumber,
} from "@/lib/db/whatsapp";
import { sendEmailWithAttachment } from "@/lib/email/send-with-attachment";

/**
 * Mode dry-run du checkout — pas encore branché à Stripe.
 *
 * Quand l'utilisateur clique "Payer", on simule un paiement réussi et on :
 *
 *  1. Active les modules sélectionnés sur son compte client (DB)
 *  2. Attribue un numéro WhatsApp (sandbox `+14155238886` pour MVP — sera
 *     remplacé par un vrai numéro Twilio quand WhatsApp Business API
 *     sera approuvé par Meta)
 *  3. Envoie un email de bienvenue avec son numéro WhatsApp + lien d'onboarding
 *  4. Redirige vers la zone client (`/client-area?clientId=...`)
 *
 * Quand Stripe sera branché : remplacer ce flow par
 *   POST /api/checkout → Stripe Checkout Session → webhook
 *   stripe.checkout.session.completed → cette même logique de provisioning.
 *
 * Pour activer le mode Stripe (plus tard) : flag env var
 *   ENABLE_STRIPE=true → /checkout redirige vers /api/checkout (à coder)
 *   au lieu de cette action dry-run.
 */

const SANDBOX_NUMBER = "+14155238886";

const inputSchema = z.object({
  clientId: z.string().uuid(),
  moduleIds: z.array(z.string()),
});

export async function completeCheckoutDryRun(
  formData: FormData,
): Promise<{ error?: string }> {
  await ensureLoaded();

  const parsed = inputSchema.safeParse({
    clientId: formData.get("clientId"),
    moduleIds: String(formData.get("moduleIds") ?? "")
      .split(",")
      .filter(Boolean),
  });
  if (!parsed.success) {
    return { error: "Données invalides — recommence depuis le début" };
  }

  const { clientId, moduleIds } = parsed.data;

  const client = getClient(clientId);
  if (!client) {
    return { error: "Client introuvable. Recommence l'inscription." };
  }

  try {
    // 1) Activer les modules choisis
    for (const moduleId of moduleIds) {
      try {
        await setClientModuleEnabled(clientId, moduleId, true);
      } catch (err) {
        console.error(
          `[checkout-dryrun] module ${moduleId} échec : ${(err as Error).message}`,
        );
      }
    }
    // Toujours activer daily-triage (clé du produit)
    if (!moduleIds.includes("daily-triage")) {
      try {
        await setClientModuleEnabled(clientId, "daily-triage", true);
      } catch {
        // module pas trouvé : non bloquant
      }
    }

    // 2) Attribuer un numéro WhatsApp (sandbox MVP — libère + réattribue
    //    si déjà pris par un autre client de test).
    let sandboxExisting = await getNumberByPhone(SANDBOX_NUMBER);
    if (!sandboxExisting) {
      sandboxExisting = await importNumber({
        phoneNumber: SANDBOX_NUMBER,
        notes: "Sandbox Twilio (via checkout dry-run)",
        monthlyCostCents: 0,
      });
    }
    if (
      sandboxExisting.status === "assigned" &&
      sandboxExisting.clientId !== clientId
    ) {
      await releaseNumber(sandboxExisting.id);
    }

    const provisioned = await provisionAgentForClient({
      clientId,
      userPhone: client.contactPhone,
    });
    const assignedNumber = provisioned.number.phoneNumber;

    // 3) Email de bienvenue avec numéro + lien d'onboarding
    if (client.contactEmail) {
      const onboardingUrl = `https://agenit-ia.vercel.app/onboarding/connect-google?clientId=${clientId}`;
      const dashboardUrl = `https://agenit-ia.vercel.app/client-area?clientId=${clientId}`;
      await sendEmailWithAttachment({
        to: client.contactEmail,
        subject: `🎉 Bienvenue ${client.name} — ton agent IA est prêt`,
        text: [
          `Bonjour ${client.name},`,
          ``,
          `Ton agent IA est activé. Voici tes infos :`,
          ``,
          `📱 Numéro WhatsApp de ton agent : ${assignedNumber}`,
          ``,
          `Pour commencer :`,
          `1. Ajoute ${assignedNumber} dans tes contacts WhatsApp`,
          `2. Tape "join porche roulant" depuis ton WhatsApp (sandbox temporaire)`,
          `3. Écris "Salut" à ton agent — il te répondra`,
          ``,
          `Connecte ton Gmail + Calendar (recommandé) :`,
          onboardingUrl,
          ``,
          `Ton espace client :`,
          dashboardUrl,
          ``,
          `Une question ? Réponds simplement à cet email.`,
          ``,
          `À très vite,`,
          `L'équipe Agenit IA`,
        ].join("\n"),
      });
    }
  } catch (err) {
    console.error("[checkout-dryrun] échec :", err);
    return { error: (err as Error).message };
  }

  redirect(`/client-area?clientId=${clientId}`);
}
