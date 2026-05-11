import { NextResponse, type NextRequest } from "next/server";
import { chatWithAgent } from "@/agent/brain";
import { ensureLoaded, listClients, listClientModules } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron Vercel — brief planning du soir pour les clients avec
 * le module `daily-triage` activé.
 *
 * Schedule : 0 17 * * 1-6 (17h UTC = 18h Paris hiver, 19h été),
 * du lundi au samedi.
 *
 * Pour chaque client :
 *  - read-google-calendar (range="tomorrow")
 *  - read-icall26-appointments + historique pour chaque RDV
 *  - web-search pour enrichir (météo, infos prospect, actu sur l'entreprise)
 *  - send-whatsapp-proactive avec le brief structuré
 *
 * Tests manuels :
 *   curl https://agenit-ia.vercel.app/api/cron/evening-planning?clientId=XXX
 */

const BRIEF_PROMPT = `[CRON SOIR — BRIEF PLANNING DEMAIN]

C'est le rapport quotidien automatique du soir. Voici ce que tu dois faire :

1. **Lis mon calendrier Google** pour demain avec read-google-calendar (range="tomorrow"). Liste les RDV du jour suivant.

2. **Pour CHAQUE RDV** identifié :
   - Cherche dans l'historique iCall26 (read-icall26-leads et read-icall26-appointments) si le prospect a déjà été appelé, par qui, ce qui a été dit
   - Utilise web-search pour me ramener 2-3 infos utiles sur le prospect (entreprise, actualité récente, contexte). Si c'est un particulier avec adresse, regarde la typologie du quartier / pavillon
   - Identifie 1-2 arguments différenciants à pousser (basé sur le secteur du client et l'historique)

3. **Vérifie la météo** de demain pour les RDV terrain (utiles si tournée).

4. **Envoie le brief WhatsApp** via send-whatsapp-proactive. Format :
   \`\`\`
   🌙 Brief demain — N RDV

   ⏰ 9h00 — Mme Dupont, Aix
      📞 Dernier appel: Thomas 12/05, intéressée 4kWc, budget 12k
      💡 Pousser MaPrimeRénov' (éligible)
      ⚠️ A déjà eu 2 devis concurrents

   ⏰ 14h00 — M. Martin, Marseille
      📞 1er contact, demande de devis solaire
      💡 Famille 4 personnes, toit sud probable
      🌤️ Météo : 22°C ensoleillé

   Bon ride, dors bien 🌙
   \`\`\`

   - 5 lignes max par RDV
   - Émojis pour scan rapide
   - Ton perso (c'est ton patron qu'il prépare)

S'il n'y a pas de RDV demain : envoie juste "Pas de RDV demain, profite ! 🌴"

Si une étape échoue (calendrier vide, CRM down...), continue et signale-le dans le brief.`;

interface ClientResult {
  clientId: string;
  clientName: string;
  ok: boolean;
  summary?: string;
  error?: string;
  durationMs: number;
}

async function processClient(
  clientId: string,
  clientName: string,
): Promise<ClientResult> {
  const t0 = Date.now();
  try {
    const result = await chatWithAgent({
      clientId,
      userMessage: BRIEF_PROMPT,
      channel: "api",
    });
    return {
      clientId,
      clientName,
      ok: true,
      summary: result.assistantMessage,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      clientId,
      clientName,
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - t0,
    };
  }
}

async function handle(request: NextRequest) {
  const url = new URL(request.url);
  const forceClientId = url.searchParams.get("clientId");

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && !forceClientId) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  await ensureLoaded();

  let clients = listClients();
  if (forceClientId) {
    clients = clients.filter((c) => c.id === forceClientId);
  }

  const targets = clients.filter((c) => {
    const modules = listClientModules(c.id);
    return modules.some((m) => m.moduleId === "daily-triage" && m.enabled);
  });

  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      message: forceClientId
        ? `Client ${forceClientId} introuvable ou daily-triage pas activé`
        : "Aucun client avec daily-triage actif",
    });
  }

  console.log(`[cron/evening-planning] processing ${targets.length} clients`);
  const results: ClientResult[] = [];
  const concurrency = 3;
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((c) => processClient(c.id, c.name)),
    );
    results.push(...batchResults);
  }

  const successCount = results.filter((r) => r.ok).length;
  const totalDurationMs = results.reduce((s, r) => s + r.durationMs, 0);

  console.log(
    `[cron/evening-planning] done ${successCount}/${results.length} OK in ${totalDurationMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    processed: results.length,
    successCount,
    failureCount: results.length - successCount,
    totalDurationMs,
    results,
  });
}

export const GET = handle;
export const POST = handle;
