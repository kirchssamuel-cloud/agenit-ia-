import { NextResponse, type NextRequest } from "next/server";
import {
  importNumber,
  getNumberByPhone,
  listAvailableNumbers,
  releaseNumber,
} from "@/lib/db/whatsapp";
import { provisionAgentForClient } from "@/lib/whatsapp/number-manager";
import {
  createClient,
  setClientModuleEnabled,
  ensureLoaded,
  listClients,
} from "@/lib/db/store";
import { MODULE_REGISTRY } from "@/modules/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Setup MVP — endpoint API direct (bypasse l'UI admin /whatsapp).
 *
 * GET pour debug (description), POST pour exécuter avec ?phone=+33...
 *
 * Pareil que setupMvpAction (server action de la page admin) mais en route
 * REST pour pouvoir l'appeler depuis curl ou un navigateur quand l'UI bug.
 */

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "setup-mvp",
    usage: "POST /api/setup-mvp avec body JSON: { phone: '+336XXXXXXXX', clientName?: 'optional' }",
    note: "Le téléphone doit avoir fait 'join <code>' au sandbox Twilio +14155238886 avant pour recevoir l'onboarding.",
  });
}

export async function POST(req: NextRequest) {
  try {
    await ensureLoaded();

    const body = (await req.json().catch(() => ({}))) as {
      phone?: string;
      clientName?: string;
    };

    const userPhone = (body.phone ?? "").trim();
    const clientName = (body.clientName ?? "").trim() || "Client Demo MVP";

    if (!userPhone.match(/^\+\d{8,15}$/)) {
      return NextResponse.json(
        { ok: false, error: "phone invalide — format E.164 attendu (ex: +33612345678)" },
        { status: 400 },
      );
    }

    // 1. Import sandbox number if not present, sinon release-le pour
    //    pouvoir le réattribuer au client courant (idempotent).
    const sandboxPhone = "+14155238886";
    let existing = await getNumberByPhone(sandboxPhone);
    if (!existing) {
      existing = await importNumber({
        phoneNumber: sandboxPhone,
        notes: "Sandbox Twilio (via /api/setup-mvp)",
        monthlyCostCents: 0,
      });
    }
    // Si le sandbox est déjà attribué à un autre client (test précédent),
    // on le libère pour pouvoir le réattribuer au client courant.
    if (existing.status === "assigned") {
      await releaseNumber(existing.id);
    }

    // 2. Verify a free number exists
    const available = await listAvailableNumbers();
    if (available.length === 0) {
      return NextResponse.json(
        { ok: false, error: "NO_AVAILABLE_NUMBER — sandbox importé mais pas listé comme libre" },
        { status: 500 },
      );
    }

    // 3. Réutilise un client existant avec le même contactPhone, sinon crée-le
    let client = listClients().find(
      (c) => c.contactPhone === userPhone,
    );
    if (!client) {
      client = await createClient({
        name: clientName,
        contactEmail: "demo@agent-platform.local",
        contactPhone: userPhone,
        industry: "Test MVP — tous secteurs",
        notes: "Client créé via /api/setup-mvp",
      });
    }

    // 4. Enable all modules on this client
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
        console.error(`[setup-mvp] module ${m.id} échec : ${(err as Error).message}`);
      }
    }

    // 5. Assign number + send onboarding
    const result = await provisionAgentForClient({
      clientId: client.id,
      userPhone,
    });

    return NextResponse.json({
      ok: true,
      client: { id: client.id, name: client.name },
      agentNumber: result.number.phoneNumber,
      modulesActivated,
      onboardingSent: result.onboardingSent,
      twilioSid: result.twilioSid,
      note: result.onboardingSent
        ? "Message d'onboarding envoyé sur ton WhatsApp."
        : "Onboarding pas envoyé (vérifie que tu as fait 'join <code>' au sandbox).",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message,
        stack: (err as Error).stack?.split("\n").slice(0, 5).join("\n"),
      },
      { status: 500 },
    );
  }
}
