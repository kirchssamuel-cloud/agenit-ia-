import { NextResponse, type NextRequest } from "next/server";
import { startWorkflow, continueWorkflowWithInput } from "@/lib/workflows/engine";
import { findActiveInstanceForClient, getWorkflowInstance } from "@/lib/workflows/db";
import { ensureLoaded, listClients } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/admin/workflows/run-devis-test — endpoint de test du workflow devis-btp.
 *
 * Usage :
 *   1) Démarrer un workflow avec une demande simulée :
 *      POST /api/admin/workflows/run-devis-test
 *      { "action": "start", "clientId": "...", "rawRequest": "Je veux un devis pour 50m² carrelage premium" }
 *
 *   2) Simuler une réponse owner (validation/marge) :
 *      POST /api/admin/workflows/run-devis-test
 *      { "action": "continue", "instanceId": "...", "ownerText": "+30%" }
 *
 *   3) Lister les instances actives d'un client :
 *      GET /api/admin/workflows/run-devis-test?clientId=...
 */

export async function POST(req: NextRequest) {
  try {
    await ensureLoaded();
    const body = (await req.json().catch(() => ({}))) as {
      action?: "start" | "continue";
      clientId?: string;
      rawRequest?: string;
      instanceId?: string;
      ownerText?: string;
    };

    if (body.action === "start") {
      // Récupère un clientId : explicite, ou 1er en DB, sinon erreur
      let clientId = body.clientId;
      if (!clientId) {
        const c = listClients()[0];
        if (!c) {
          return NextResponse.json(
            { ok: false, error: "Aucun client en DB — lance Setup MVP d'abord" },
            { status: 400 },
          );
        }
        clientId = c.id;
      }

      const rawRequest =
        body.rawRequest ??
        "Bonjour, je voudrais un devis pour 50m² de carrelage premium dans ma salle de bain. Mon email : test@example.com. Cordialement, Marc Dupond.";

      const instance = await startWorkflow({
        clientId,
        workflowName: "devis-btp",
        initialState: { rawRequest },
      });

      return NextResponse.json({
        ok: true,
        action: "start",
        instance: {
          id: instance.id,
          status: instance.status,
          currentStep: instance.currentStep,
          state: instance.state,
          waitingFor: instance.waitingFor,
          lastError: instance.lastError,
        },
      });
    }

    if (body.action === "continue") {
      const instanceId = body.instanceId;
      const ownerText = body.ownerText;
      if (!instanceId || !ownerText) {
        return NextResponse.json(
          { ok: false, error: "instanceId et ownerText requis pour continue" },
          { status: 400 },
        );
      }
      const instance = await continueWorkflowWithInput(instanceId, {
        text: ownerText,
      });
      return NextResponse.json({
        ok: true,
        action: "continue",
        instance: {
          id: instance.id,
          status: instance.status,
          currentStep: instance.currentStep,
          state: instance.state,
          waitingFor: instance.waitingFor,
          lastError: instance.lastError,
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "action requise : 'start' (avec clientId+rawRequest) ou 'continue' (avec instanceId+ownerText)",
      },
      { status: 400 },
    );
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

export async function GET(req: NextRequest) {
  await ensureLoaded();
  const clientId = req.nextUrl.searchParams.get("clientId");
  const instanceId = req.nextUrl.searchParams.get("instanceId");

  if (instanceId) {
    const instance = await getWorkflowInstance(instanceId);
    return NextResponse.json({ ok: true, instance });
  }

  if (clientId) {
    const active = await findActiveInstanceForClient(clientId);
    return NextResponse.json({ ok: true, active });
  }

  return NextResponse.json({
    ok: true,
    service: "workflows-test",
    usage: {
      start:
        "POST avec { action: 'start', clientId?: string, rawRequest?: string }",
      continue:
        "POST avec { action: 'continue', instanceId: string, ownerText: string }",
      query: "GET ?clientId=X ou ?instanceId=Y",
    },
  });
}
