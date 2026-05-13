import { NextResponse, type NextRequest } from "next/server";
import {
  ensureLoaded,
  createClient,
  setClientModuleEnabled,
  listClientModules,
} from "@/lib/db/store";
import {
  getNumberByPhone,
  importNumber,
  releaseNumber,
  getNumberForClient,
} from "@/lib/db/whatsapp";
import { provisionAgentForClient } from "@/lib/whatsapp/number-manager";
import { sendEmailWithAttachment } from "@/lib/email/send-with-attachment";
import { getModuleById } from "@/modules/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/admin/e2e-signup-test — simule le parcours signup COMPLET en backend
 * pour valider que tout marche en autonomie, sans clics manuels.
 *
 * Fait dans l'ordre :
 *   1. createClient (= signupAction)
 *   2. setClientModuleEnabled pour chaque module (= activateModulesAction)
 *   3. release+reassign sandbox + provisionAgentForClient (= completeCheckoutDryRun)
 *   4. sendEmailWithAttachment (= completeCheckoutDryRun)
 *   5. Lookup final : client, agent number, modules actifs
 *
 * Retourne un rapport complet avec succès/échec à chaque étape.
 */

const SANDBOX_NUMBER = "+14155238886";

interface StepResult {
  step: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

async function runStep<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<StepResult & { result?: T }> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return {
      step: name,
      ok: true,
      data: result,
      result,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      step: name,
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - t0,
    };
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    phone?: string;
    moduleIds?: string[];
  };

  const testEmail = body.email ?? `e2e-test-${Date.now()}@agent-platform.test`;
  const testName = body.name ?? `E2E Test ${new Date().toISOString().slice(0, 10)}`;
  const testPhone = body.phone;
  const moduleIds = body.moduleIds ?? ["daily-triage"];

  const steps: Array<StepResult & { result?: unknown }> = [];

  await ensureLoaded();

  // Étape 1 : createClient (mimics signupAction)
  const s1 = await runStep("createClient", () =>
    createClient({
      name: testName,
      contactEmail: testEmail,
      contactPhone: testPhone,
      industry: "E2E test",
      notes: "Créé par /api/admin/e2e-signup-test",
    }),
  );
  steps.push(s1);
  if (!s1.ok) {
    return NextResponse.json(
      { ok: false, failedAt: "createClient", steps },
      { status: 500 },
    );
  }
  const client = s1.result as { id: string; name: string; contactEmail?: string };

  // Étape 2 : activer les modules sélectionnés
  const activated: string[] = [];
  const moduleErrors: Array<{ id: string; error: string }> = [];
  for (const moduleId of moduleIds) {
    const mod = getModuleById(moduleId);
    if (!mod) {
      moduleErrors.push({ id: moduleId, error: "module unknown in registry" });
      continue;
    }
    const sub = await runStep(`setClientModuleEnabled:${moduleId}`, () =>
      setClientModuleEnabled(
        client.id,
        moduleId,
        true,
        (mod.defaultConfig ?? {}) as Record<string, unknown>,
      ),
    );
    steps.push(sub);
    if (sub.ok) activated.push(moduleId);
    else moduleErrors.push({ id: moduleId, error: sub.error ?? "?" });
  }

  // Étape 3 : provision sandbox WhatsApp (release+reassign si pris)
  const s3 = await runStep("provisionWhatsApp", async () => {
    let existing = await getNumberByPhone(SANDBOX_NUMBER);
    if (!existing) {
      existing = await importNumber({
        phoneNumber: SANDBOX_NUMBER,
        notes: "Sandbox Twilio (via e2e-test)",
        monthlyCostCents: 0,
      });
    }
    if (existing.status === "assigned" && existing.clientId !== client.id) {
      await releaseNumber(existing.id);
    }
    return provisionAgentForClient({
      clientId: client.id,
      userPhone: testPhone,
    });
  });
  steps.push(s3);
  if (!s3.ok) {
    return NextResponse.json(
      {
        ok: false,
        failedAt: "provisionWhatsApp",
        client,
        activated,
        moduleErrors,
        steps,
      },
      { status: 500 },
    );
  }
  const provisioned = s3.result as {
    number: { phoneNumber: string };
    onboardingSent: boolean;
    twilioSid?: string;
  };

  // Étape 4 : email de bienvenue
  const s4 = await runStep("sendWelcomeEmail", () =>
    sendEmailWithAttachment({
      to: testEmail,
      subject: `🎉 Bienvenue ${testName} — E2E test`,
      text: [
        `Bonjour ${testName},`,
        ``,
        `Ton agent IA est prêt.`,
        ``,
        `📱 Numéro WhatsApp : ${provisioned.number.phoneNumber}`,
        ``,
        `Ton espace client :`,
        `https://agenit-ia.vercel.app/client-area?clientId=${client.id}`,
      ].join("\n"),
    }),
  );
  steps.push(s4);

  // Étape 5 : sanity checks
  const finalNumber = await getNumberForClient(client.id);
  const finalModules = listClientModules(client.id)
    .filter((cm) => cm.enabled)
    .map((cm) => cm.moduleId);

  const allOk =
    s1.ok &&
    s3.ok &&
    s4.ok &&
    activated.length === moduleIds.filter((id) => getModuleById(id)).length &&
    !!finalNumber;

  return NextResponse.json({
    ok: allOk,
    summary: {
      clientId: client.id,
      clientName: client.name,
      contactEmail: testEmail,
      agentNumber: finalNumber?.phoneNumber ?? null,
      modulesActivated: activated,
      moduleErrors,
      finalActiveModules: finalModules,
      emailMessageId:
        (s4.result as { messageId?: string } | undefined)?.messageId ?? null,
      emailFailReason:
        (s4.result as { reason?: string } | undefined)?.reason ?? null,
      welcomeEmailOk: s4.ok,
    },
    steps,
    clientAreaUrl: `https://agenit-ia.vercel.app/client-area?clientId=${client.id}`,
  });
}

export async function GET() {
  return NextResponse.json({
    service: "e2e-signup-test",
    method: "POST",
    description:
      "Simule signup→activate-modules→checkout en backend, retourne le rapport.",
    usage:
      "POST avec { email?, name?, phone?, moduleIds?: string[] }. Sans body, utilise des valeurs par défaut.",
  });
}
