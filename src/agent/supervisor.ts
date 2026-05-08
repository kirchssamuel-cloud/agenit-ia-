import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getClient, listClientModules } from "@/lib/db/store";
import { getClientContext, listRecentMemories } from "@/lib/db/agent-memory";
import { getModuleById } from "@/modules/registry";

/**
 * Agent Superviseur — second cerveau qui valide les actions critiques de l'Agent
 * Principal AVANT exécution. Architecture dual-agent :
 *
 *   Agent Principal → propose action → Agent Superviseur → ✅ ou ❌ → Exécution
 *
 * Le superviseur :
 * - Vérifie la cohérence des données (prix, marges, valeurs aberrantes)
 * - Vérifie la conformité aux préférences/règles du client
 * - Détecte les infos manquantes
 * - Refuse en clair avec une raison actionnable si problème
 *
 * Si pas de clé Anthropic → mode démo : auto-approve tout (fail-open).
 * Pour la prod on peut basculer sur fail-closed via env var.
 */

interface SuperviseInput {
  clientId: string;
  conversationId?: string;
  toolId: string;
  toolName: string;
  toolDescription: string;
  input: unknown;
  /** Le message original du user qui a déclenché cette proposition d'action */
  userMessage: string;
}

export interface SupervisorDecision {
  approved: boolean;
  reason?: string;
  confidence: number;
  costCents: number;
}

const SUPERVISOR_MODEL = "claude-sonnet-4-7";
const SUPERVISOR_MAX_TOKENS = 800;

const SUPERVISOR_SYSTEM = `Tu es l'AGENT SUPERVISEUR d'une plateforme d'agents IA SaaS.

Ton rôle : valider ou rejeter les actions proposées par l'Agent Principal AVANT leur exécution.

Tu vérifies :
1. **Cohérence des données** — Les valeurs sont-elles plausibles (prix, surfaces, dates, emails) ?
2. **Conformité client** — L'action respecte-t-elle les préférences/règles connues du client ?
3. **Complétude** — Manque-t-il une information critique ?
4. **Sécurité** — Aucun envoi à un destinataire suspect, aucun montant aberrant ?

Tu réponds UNIQUEMENT en JSON strict, sans markdown, sans texte autour :

{
  "approved": true | false,
  "reason": "phrase courte expliquant la décision (obligatoire si rejected)",
  "confidence": 0.0 à 1.0
}

Sois strict mais pas paranoïaque. Approve par défaut sauf si tu vois un vrai risque ou une donnée incohérente.
Si tu rejettes, la "reason" doit être actionnable pour que l'Agent Principal puisse corriger.`;

interface SupervisorJSONResponse {
  approved?: boolean;
  reason?: string;
  confidence?: number;
}

function parseDecision(text: string): SupervisorJSONResponse | null {
  // Extraction du premier bloc JSON (l'IA peut parfois ajouter du préambule).
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as SupervisorJSONResponse;
  } catch {
    return null;
  }
}

function isSupabasePlaceholder(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return (
    process.env.DEMO_MODE === "true" ||
    url.includes("placeholder") ||
    key.includes("placeholder") ||
    url === "" ||
    key === ""
  );
}

async function logDecision(input: {
  clientId: string;
  conversationId?: string;
  toolName: string;
  proposedInput: unknown;
  decision: SupervisorDecision;
}): Promise<void> {
  if (isSupabasePlaceholder()) return; // pas de log en mode démo
  try {
    const sb = createSupabaseAdminClient();
    await sb.from("supervisor_decisions").insert({
      client_id: input.clientId,
      conversation_id: input.conversationId ?? null,
      tool_name: input.toolName,
      proposed_input: input.proposedInput as Record<string, unknown>,
      decision: input.decision.approved ? "approved" : "rejected",
      reason: input.decision.reason ?? null,
      confidence: input.decision.confidence,
      cost_cents: input.decision.costCents,
    });
  } catch (err) {
    // best-effort, on ne bloque pas l'exécution si le log échoue
    console.error(`[supervisor] log échec : ${(err as Error).message}`);
  }
}

/**
 * Demande au superviseur de valider un tool call. Retourne la décision +
 * la raison + confiance.
 *
 * Fail-open : si le superviseur ne peut pas répondre (pas de clé API, erreur),
 * approve par défaut pour ne pas bloquer l'agent. À durcir en fail-closed
 * via env var SUPERVISOR_FAIL_CLOSED=true en prod sensible.
 */
export async function superviseToolCall(
  input: SuperviseInput,
): Promise<SupervisorDecision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const failClosed = process.env.SUPERVISOR_FAIL_CLOSED === "true";

  if (!apiKey) {
    return {
      approved: !failClosed,
      reason: failClosed
        ? "ANTHROPIC_API_KEY absent et fail-closed activé"
        : "Validation skip (pas de clé Anthropic)",
      confidence: 0,
      costCents: 0,
    };
  }

  // Charger le contexte minimal pour donner un peu de contexte au superviseur.
  // On ne charge pas TOUTE la mémoire : ce serait coûteux et le superviseur
  // travaille sur la cohérence locale, pas l'historique long.
  const [client, ctx, recentMems] = await Promise.all([
    Promise.resolve(getClient(input.clientId)),
    getClientContext(input.clientId).catch(() => null),
    listRecentMemories(input.clientId, 5).catch(() => []),
  ]);

  const moduleSnapshot = listClientModules(input.clientId)
    .filter((cm) => cm.enabled)
    .map((cm) => {
      const mod = getModuleById(cm.moduleId);
      return mod ? `- ${mod.name} (${mod.id})` : `- ${cm.moduleId}`;
    })
    .join("\n");

  const userPrompt = [
    `# Action proposée par l'Agent Principal`,
    `Tool : ${input.toolName} (${input.toolId})`,
    `Description du tool : ${input.toolDescription}`,
    "",
    "## Input proposé",
    "```json",
    JSON.stringify(input.input, null, 2),
    "```",
    "",
    "## Contexte client",
    `Nom : ${client?.name ?? "?"}`,
    `Secteur : ${ctx?.sector ?? client?.industry ?? "non renseigné"}`,
    `Ton préféré : ${ctx?.tone ?? "professionnel"}`,
    moduleSnapshot
      ? `Modules actifs :\n${moduleSnapshot}`
      : "Modules actifs : aucun",
    ctx?.preferences && Object.keys(ctx.preferences).length > 0
      ? `Préférences : ${JSON.stringify(ctx.preferences)}`
      : "",
    "",
    "## Message original du user",
    input.userMessage,
    "",
    recentMems.length > 0
      ? `## Souvenirs récents\n${recentMems
          .map((m) => `- [${m.type}] ${m.content.slice(0, 200)}`)
          .join("\n")}`
      : "",
    "",
    "Décide : approved ou rejected ? Réponds en JSON.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: SUPERVISOR_MODEL,
      max_tokens: SUPERVISOR_MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SUPERVISOR_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const raw = textBlock?.text ?? "";
    const parsed = parseDecision(raw);

    // Coût Sonnet 4.7 : ~$3/M input, $15/M output
    const costCents = Math.round(
      (response.usage.input_tokens / 1_000_000) * 300 +
        (response.usage.output_tokens / 1_000_000) * 1_500,
    );

    if (!parsed || typeof parsed.approved !== "boolean") {
      // Réponse inexploitable → fail-open par défaut, fail-closed si configuré.
      const decision: SupervisorDecision = {
        approved: !failClosed,
        reason: `Réponse superviseur inexploitable : ${raw.slice(0, 100)}`,
        confidence: 0,
        costCents,
      };
      await logDecision({
        clientId: input.clientId,
        conversationId: input.conversationId,
        toolName: input.toolName,
        proposedInput: input.input,
        decision,
      });
      return decision;
    }

    const decision: SupervisorDecision = {
      approved: parsed.approved,
      reason: parsed.reason,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      costCents,
    };
    await logDecision({
      clientId: input.clientId,
      conversationId: input.conversationId,
      toolName: input.toolName,
      proposedInput: input.input,
      decision,
    });
    return decision;
  } catch (err) {
    console.error(`[supervisor] échec : ${(err as Error).message}`);
    return {
      approved: !failClosed,
      reason: `Superviseur indisponible : ${(err as Error).message}`,
      confidence: 0,
      costCents: 0,
    };
  }
}
