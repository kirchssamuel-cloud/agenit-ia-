import { NextResponse, type NextRequest } from "next/server";
import {
  retrieveMemories,
  storeMemory,
  getClientContext,
  upsertClientContext,
  type MemoryEntry,
} from "@/lib/db/agent-memory";
import {
  detectSector,
  SECTOR_REGISTRY,
  type SectorId,
} from "@/agent/sector-detector";

/**
 * Route /api/agent/demo — endpoint démo qui simule le comportement de l'agent
 * complet (Phase 1 + Phase 2) sans dépendre d'Anthropic ni de Supabase configurés.
 *
 * Démontre visuellement à un prospect :
 * - Recherche sémantique RAG (vraie : utilise le store agent-memory en RAM)
 * - Réponse de l'agent (stubbée si pas de clé Anthropic)
 * - Décision du superviseur sur les actions critiques (stubbée si pas de clé)
 *
 * En prod (avec toutes les clés), il suffira de pointer la même UI vers
 * /api/agent/chat (la vraie route auth-protégée qui appelle chatWithAgent).
 */

export const dynamic = "force-dynamic";

interface DemoRequest {
  clientId: string;
  message: string;
}

interface DemoResponse {
  ok: boolean;
  assistantMessage: string;
  retrievedMemories: Array<{
    type: string;
    content: string;
    similarity?: number;
    importance: number;
  }>;
  supervisorDecisions: Array<{
    toolName: string;
    proposedInput: Record<string, unknown>;
    approved: boolean;
    reason: string;
    confidence: number;
  }>;
  /** Détection automatique du secteur métier (1er message uniquement) */
  sectorDetection?: {
    sector: SectorId;
    sectorName: string;
    confidence: number;
    reason: string;
    llmDetected: boolean;
    isFirstMessage: boolean;
  };
  /** Secteur courant du client (s'il est défini) */
  clientSector?: { id: SectorId; name: string };
  /** True si on est en mode démo (pas de vraies clés API) */
  isDemoMode: boolean;
  durationMs: number;
}

/**
 * Détecte les actions implicites dans le message user pour stubber des
 * décisions de superviseur réalistes.
 */
function detectImpliedActions(
  userMessage: string,
): Array<{ toolName: string; input: Record<string, unknown> }> {
  const actions: Array<{ toolName: string; input: Record<string, unknown> }> = [];
  const m = userMessage.toLowerCase();
  if (m.includes("envoie") && m.includes("mail") || m.includes("email")) {
    const subjectMatch = userMessage.match(/sujet\s*:?\s*"([^"]+)"/i);
    actions.push({
      toolName: "send-email",
      input: {
        to: "client@example.com",
        subject: subjectMatch?.[1] ?? "Suivi de votre demande",
        text: "(corps de l'email proposé par l'agent)",
      },
    });
  }
  if (
    m.includes("crm") ||
    m.includes("icall26") ||
    m.includes("pousse") ||
    m.includes("ajoute") && m.includes("lead")
  ) {
    actions.push({
      toolName: "push-icall26",
      input: {
        rows: [{ nom: "(extrait du message)", telephone: "..." }],
        columnMapping: {},
      },
    });
  }
  return actions;
}

/**
 * Stub de réponse agent : génère une réponse cohérente avec le message
 * en s'appuyant sur les souvenirs retrouvés. Utilisé tant qu'aucune clé
 * Anthropic n'est configurée.
 */
function stubAgentResponse(
  userMessage: string,
  retrieved: MemoryEntry[],
): string {
  const lines: string[] = [];
  if (retrieved.length > 0) {
    lines.push(
      `D'après ce que je sais déjà sur toi (${retrieved.length} souvenirs pertinents retrouvés), je peux t'aider sur ça.`,
    );
  } else {
    lines.push("Compris.");
  }
  lines.push("");
  if (userMessage.toLowerCase().includes("devis")) {
    lines.push(
      "Je vais préparer le devis. Avant de l'envoyer, le superviseur valide la cohérence des prix et la marge.",
    );
  } else if (userMessage.toLowerCase().includes("rdv") || userMessage.toLowerCase().includes("rendez")) {
    lines.push(
      "Je note le RDV. Si je dois confirmer par email, le superviseur vérifie d'abord le destinataire et le contenu.",
    );
  } else if (userMessage.toLowerCase().includes("lead")) {
    lines.push(
      "Je traite les leads (nettoyage, dédup, normalisation téléphones). Pour le push iCall26, validation superviseur obligatoire.",
    );
  } else {
    lines.push(
      "Je m'en occupe. Si une action a un effet de bord externe (envoi email, push CRM), elle passera par le superviseur.",
    );
  }
  lines.push("");
  lines.push("⚠️ Mode démo : pas encore de vraie clé Anthropic configurée. Avec la clé, je raisonnerais et exécuterais réellement.");
  return lines.join("\n");
}

/** Stub décision superviseur : approuve sauf si "test rejection" dans le message. */
function stubSupervisorDecision(
  toolName: string,
  input: Record<string, unknown>,
  userMessage: string,
): { approved: boolean; reason: string; confidence: number } {
  const reject = userMessage.toLowerCase().includes("test rejet") ||
    userMessage.toLowerCase().includes("rejette");
  if (reject) {
    return {
      approved: false,
      reason:
        "Données incohérentes détectées : marge inférieure au minimum client. Reformule avec marge ≥ 25%.",
      confidence: 0.92,
    };
  }
  // Approve par défaut avec une raison plausible
  if (toolName === "send-email") {
    return {
      approved: true,
      reason: "Destinataire connu, sujet aligné avec la demande, ton conforme aux préférences client.",
      confidence: 0.88,
    };
  }
  if (toolName === "push-icall26") {
    return {
      approved: true,
      reason: "Données nettoyées et dédupliquées, mapping cohérent avec la config du client.",
      confidence: 0.85,
    };
  }
  return {
    approved: true,
    reason: "Action conforme au contexte client.",
    confidence: 0.8,
  };
}

function isDemoMode(): boolean {
  return (
    !process.env.ANTHROPIC_API_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") ||
    process.env.DEMO_MODE === "true"
  );
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const body = (await request.json()) as DemoRequest;

  if (!body.clientId || !body.message) {
    return NextResponse.json(
      { ok: false, error: "clientId et message requis" },
      { status: 400 },
    );
  }

  const demoMode = isDemoMode();

  // Recherche sémantique + chargement contexte client (secteur si déjà défini)
  const [retrieved, existingContext] = await Promise.all([
    retrieveMemories({
      clientId: body.clientId,
      query: body.message,
      limit: 5,
      matchThreshold: 0.5,
    }).catch(() => [] as MemoryEntry[]),
    getClientContext(body.clientId).catch(() => null),
  ]);

  // ÉTAPE 1.3 : Auto-détection de secteur au 1er message
  // (si pas encore défini ET aucun souvenir précédent → c'est le 1er message)
  let sectorDetectionResult: DemoResponse["sectorDetection"] = undefined;
  let currentSectorId: SectorId | undefined = existingContext?.sector as
    | SectorId
    | undefined;
  const isFirstMessage = retrieved.length === 0 && !existingContext?.sector;
  if (isFirstMessage) {
    const detection = await detectSector(body.message);
    if (detection.sector !== "autre" && detection.confidence > 0.4) {
      currentSectorId = detection.sector;
      // Persiste le secteur détecté pour les prochains messages
      await upsertClientContext({
        clientId: body.clientId,
        sector: detection.sector,
      }).catch(() => undefined);
    }
    sectorDetectionResult = {
      sector: detection.sector,
      sectorName: SECTOR_REGISTRY[detection.sector].name,
      confidence: detection.confidence,
      reason: detection.reason,
      llmDetected: detection.llmDetected,
      isFirstMessage: true,
    };
  }

  // Réponse agent (stubbée pour la démo)
  const assistantMessage = stubAgentResponse(body.message, retrieved);

  // Détection d'actions implicites + décisions superviseur
  const impliedActions = detectImpliedActions(body.message);
  const supervisorDecisions = impliedActions.map((a) => ({
    toolName: a.toolName,
    proposedInput: a.input,
    ...stubSupervisorDecision(a.toolName, a.input, body.message),
  }));

  // Persiste le souvenir : marche en démo (RAM) ou en prod (DB).
  // Best effort, on continue même si ça échoue.
  await storeMemory({
    clientId: body.clientId,
    type: "conversation",
    content: `User : ${body.message}\nAgent : ${assistantMessage}`,
    metadata: {
      demoMode,
      impliedActions: impliedActions.map((a) => a.toolName),
    },
    importance: impliedActions.length > 0 ? 0.7 : 0.5,
  }).catch((err) => {
    console.error(`[demo-chat] storeMemory échec : ${(err as Error).message}`);
  });

  const response: DemoResponse = {
    ok: true,
    assistantMessage,
    retrievedMemories: retrieved.map((m) => ({
      type: m.type,
      content: m.content.slice(0, 300),
      similarity: m.similarity,
      importance: m.importance,
    })),
    supervisorDecisions,
    sectorDetection: sectorDetectionResult,
    clientSector: currentSectorId
      ? {
          id: currentSectorId,
          name: SECTOR_REGISTRY[currentSectorId].name,
        }
      : undefined,
    isDemoMode: demoMode,
    durationMs: Date.now() - t0,
  };

  return NextResponse.json(response);
}
