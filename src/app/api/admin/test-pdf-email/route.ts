import { NextResponse, type NextRequest } from "next/server";
import { renderDevisPdf, type DevisData } from "@/lib/pdf/devis-template";
import { sendEmailWithAttachment } from "@/lib/email/send-with-attachment";
import { ensureLoaded, getClient } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Test silencieux : génère un PDF de devis + envoie email avec PDF attaché.
 * AUCUN envoi WhatsApp. Pour vérifier que Resend + React-PDF marchent
 * sans déclencher le workflow complet (qui envoie 2 WhatsApp).
 *
 * Usage:
 *   POST /api/admin/test-pdf-email
 *   { "clientId": "...", "to": "kirchs.samuel@gmail.com" }
 */

export async function POST(req: NextRequest) {
  try {
    await ensureLoaded();
    const body = (await req.json().catch(() => ({}))) as {
      clientId?: string;
      to?: string;
      surface?: number;
      type?: string;
      gamme?: "budget" | "moyen" | "premium";
      nomClient?: string;
    };

    const to = body.to ?? "kirchs.samuel@gmail.com";
    const clientId = body.clientId ?? "57c11811-d193-4924-9873-d50e08b95706";
    const client = getClient(clientId);

    const surface = body.surface ?? 50;
    const type = body.type ?? "carrelage";
    const gamme = body.gamme ?? "premium";
    const nomClient = body.nomClient ?? "Marc Dupond";

    const prixCatalogue: Record<string, number> = {
      budget: 25,
      moyen: 35,
      premium: 55,
    };
    const prixHtM2 = prixCatalogue[gamme] ?? 35;
    const sousTotal = prixHtM2 * surface;
    const marge = 1.4;
    const totalHt = Math.round(sousTotal * marge);
    const tva = Math.round(totalHt * 0.1);
    const totalTtc = totalHt + tva;

    const numero = `TEST-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const date = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const data: DevisData = {
      numero,
      date,
      client: { nom: nomClient, email: to },
      prestation: { type, gamme, surface, prixHtM2 },
      calcul: { sousTotal, marge, totalHt, tva, totalTtc },
      emetteur: client
        ? {
            nom: client.name,
            email: client.contactEmail,
            telephone: client.contactPhone,
          }
        : undefined,
    };

    // Génère PDF
    const pdfBuffer = await renderDevisPdf(data);

    // Envoie email
    const result = await sendEmailWithAttachment({
      to,
      subject: `Devis test ${numero} — ${totalTtc}€ TTC`,
      text: `Test envoi PDF depuis agent IA.\n\nDétails: ${surface}m² ${type} ${gamme}\nTotal TTC: ${totalTtc}€\n\nPDF en pièce jointe.`,
      attachments: [
        {
          filename: `Devis-${numero}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({
      ok: result.ok,
      to,
      numero,
      pdfSizeBytes: pdfBuffer.byteLength,
      emailMessageId: result.messageId,
      emailReason: result.reason,
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

export async function GET() {
  return NextResponse.json({
    service: "test-pdf-email",
    method: "POST",
    description:
      "Génère PDF + envoie email (Resend). ZÉRO WhatsApp. Pour tester silencieusement.",
    usage:
      "POST avec { to?: email, clientId?: uuid, surface?: number, type?: string, gamme?: 'budget'|'moyen'|'premium', nomClient?: string }",
  });
}
