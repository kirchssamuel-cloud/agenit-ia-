import { NextResponse, type NextRequest } from "next/server";
import { chatWithGemini, estimateGeminiCostCents } from "@/lib/llm/gemini-client";
import { PERSONALITY_PROMPT } from "@/agent/personality";
import { buildKnowledgePromptForSector } from "@/lib/knowledge/loader";
import { detectSector, buildSectorPromptBlock, type SectorId } from "@/agent/sector-detector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/agent-gemini-test — endpoint test pour évaluer la qualité de
 * Gemini 2.5 Flash sur les cas d'usage de l'agent (BTP, commercial,
 * comptabilité) avec le même system prompt que brain.ts.
 *
 * Pas de tool use, pas de mémoire vectorielle, pas de DB — juste le
 * cerveau Gemini avec personality + knowledge base pour vérifier que
 * la qualité conversationnelle est suffisante avant de l'intégrer
 * proprement à brain.ts.
 *
 * Usage:
 *   curl -X POST https://agenit-ia.vercel.app/api/agent-gemini-test \
 *     -H "Content-Type: application/json" \
 *     -d '{"message": "Devis 50m² carrelage premium"}'
 */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
      sector?: string;
      history?: Array<{ role: "user" | "model"; text: string }>;
      model?: "gemini-2.5-flash" | "gemini-2.5-flash-lite" | "gemini-2.5-pro";
    };

    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "message required" },
        { status: 400 },
      );
    }

    // Détecte le secteur si pas fourni
    let sector = body.sector as SectorId | undefined;
    if (!sector) {
      try {
        const det = await detectSector(message);
        if (det.confidence > 0.5) sector = det.sector;
      } catch {
        // Pas grave — on tourne sans secteur si détection échoue
      }
    }

    // Construit le system prompt complet
    const nowParis = new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts: string[] = [
      "Tu es l'agent IA personnel d'un client.",
      "",
      `Date et heure actuelles (Paris) : ${nowParis}`,
      "",
      PERSONALITY_PROMPT,
    ];

    if (sector && sector !== "autre") {
      const sectorBlock = buildSectorPromptBlock(sector);
      if (sectorBlock) {
        parts.push("");
        parts.push(sectorBlock);
      }
      const knowledgeBlock = buildKnowledgePromptForSector(sector);
      if (knowledgeBlock) {
        parts.push("");
        parts.push(knowledgeBlock);
      }
    }

    const systemPrompt = parts.join("\n");

    // Appel Gemini
    const result = await chatWithGemini({
      systemPrompt,
      userMessage: message,
      history: body.history,
      model: body.model ?? "gemini-2.5-flash",
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    const costCents = estimateGeminiCostCents(
      result.tokensIn,
      result.tokensOut,
      result.model,
    );

    return NextResponse.json({
      ok: true,
      reply: result.text,
      sector: sector ?? null,
      model: result.model,
      finishReason: result.finishReason,
      tokens: {
        in: result.tokensIn,
        out: result.tokensOut,
      },
      cost: {
        cents: costCents,
        usd: (costCents / 100).toFixed(4),
        note: "Free tier = $0. Cents calculés au tarif payant (référence si on bascule en paid).",
      },
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
    ok: true,
    service: "agent-gemini-test",
    usage:
      "POST /api/agent-gemini-test avec { message: string, sector?: string, history?: [{role: 'user'|'model', text}], model?: 'gemini-2.5-flash'|'gemini-2.5-flash-lite' }",
    setupRequired:
      "GEMINI_API_KEY env var must be set (free key at https://aistudio.google.com/apikey)",
  });
}
