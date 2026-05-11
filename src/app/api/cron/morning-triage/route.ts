import { NextResponse, type NextRequest } from "next/server";
import { chatWithAgent } from "@/agent/brain";
import { ensureLoaded, listClients, listClientModules } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min (Vercel Pro nécessaire pour > 60s)

/**
 * Cron Vercel — triage matinal des emails pour les clients avec
 * le module `daily-triage` activé.
 *
 * Schedule : 0 6 * * 1-6 (06h UTC = 07h Paris en heure d'hiver, 08h en été),
 * du lundi au samedi (pas le dimanche).
 *
 * Sécurité : vérifie le header Authorization=Bearer $CRON_SECRET.
 *
 * Pour chaque client :
 *  - Invoque chatWithAgent avec un prompt standardisé
 *  - L'agent fait : read-gmail-inbox → classify → gmail-archive +
 *    push-icall26 → send-whatsapp-proactive (résumé)
 *
 * En cas d'échec sur un client, on continue avec les suivants.
 *
 * Tests manuels :
 *   curl https://agenit-ia.vercel.app/api/cron/morning-triage
 *   curl 'https://agenit-ia.vercel.app/api/cron/morning-triage?clientId=XXX'
 *     (force un seul client, sans cron secret)
 */

const TRIAGE_PROMPT = `[CRON MATIN — TRIAGE EMAILS]

C'est le rapport quotidien automatique du matin. Voici ce que tu dois faire, dans l'ordre, sans poser de question :

1. **Lis ma boîte Gmail** avec la query \`newer_than:1d -label:Triaged in:inbox\` (donc les nouveaux emails depuis hier qui ne sont pas encore triés).

2. **Classe chaque email** dans une de ces 4 catégories :
   - LEAD : prospect qui demande un devis / s'intéresse à mes services → à pousser dans iCall26
   - INFO_IMPORTANTE : email pro à lire absolument (client existant, partenaire, RDV à confirmer)
   - DEJA_TRAITE : un truc que j'ai déjà fait / réponse auto / accusé réception → archiver
   - SPAM : pub, newsletter non sollicitée, phishing → poubelle

3. **Pour les LEADS** : pousse dans iCall26 avec push-icall26 (un appel pour tous les leads en batch, mapping de colonnes selon le format Gmail). Mark les emails comme Triaged.

4. **Pour les INFO_IMPORTANTE** : note les emails dans ta mémoire (remember-fact). Garde-les dans l'inbox (pas d'archive). Ajoute le label Triaged via gmail-archive action="label-only".

5. **Pour les DEJA_TRAITE** : action='archive' via gmail-archive (label Triaged + retire INBOX).

6. **Pour les SPAM** : action='trash' via gmail-archive.

7. **Envoie un résumé WhatsApp** via send-whatsapp-proactive. Format :
   \`\`\`
   ☀️ Rapport matin
   📧 X emails traités
   🎯 Y leads → iCall26 : [liste courte noms]
   ⭐ Z importants à voir : [titres]
   🗑️ N spams jetés
   \`\`\`
   Garde ça court. Pas plus de 10 lignes.

Vas-y. Si une étape échoue, continue avec les autres et indique-le dans le résumé.`;

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
      userMessage: TRIAGE_PROMPT,
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
  // 1. Auth cron secret (sauf si forceClientId fourni en query, pour test manuel)
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

  // 2. Liste les clients avec le module daily-triage activé
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

  // 3. Process chaque client en parallèle limité (3 max)
  console.log(`[cron/morning-triage] processing ${targets.length} clients`);
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
    `[cron/morning-triage] done ${successCount}/${results.length} OK in ${totalDurationMs}ms total`,
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
