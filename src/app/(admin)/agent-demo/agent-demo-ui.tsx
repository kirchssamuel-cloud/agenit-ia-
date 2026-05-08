"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  Bot,
  Boxes,
  Check,
  Clock,
  Compass,
  Database,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  ShieldX,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface ClientOption {
  id: string;
  name: string;
  industry: string | null;
}

interface RetrievedMemory {
  type: string;
  content: string;
  similarity?: number;
  importance: number;
}

interface SupervisorDecision {
  toolName: string;
  proposedInput: Record<string, unknown>;
  approved: boolean;
  reason: string;
  confidence: number;
}

interface SectorDetection {
  sector: string;
  sectorName: string;
  confidence: number;
  reason: string;
  llmDetected: boolean;
  isFirstMessage: boolean;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrieved: RetrievedMemory[];
  supervisor: SupervisorDecision[];
  sectorDetection?: SectorDetection;
  durationMs?: number;
  /** Tokens approximatifs (estimation client si l'API ne les renvoie pas) */
  tokens?: number;
}

// ============================================================
// Modules disponibles (catalogue)
// ============================================================

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  priceEUR: number;
  /** Mots-clés métier associés pour suggérer des prompts */
  examples: string[];
}

const ALL_MODULES: ModuleInfo[] = [
  {
    id: "devis",
    name: "Devis",
    description: "Calculs m², matériaux, MO, export PDF",
    priceEUR: 49,
    examples: [
      "Calcule un devis pour 80m² de carrelage premium",
      "Génère le devis pour 50ml de plinthes",
    ],
  },
  {
    id: "crm",
    name: "CRM",
    description: "Ajout contacts, notes, relances auto",
    priceEUR: 79,
    examples: [
      "Ajoute Jean Dupont à mon CRM, plombier à Paris",
      "Relance les prospects sans nouvelles depuis 7 jours",
    ],
  },
  {
    id: "planning",
    name: "Planning",
    description: "Google Calendar, rappels WhatsApp",
    priceEUR: 29,
    examples: [
      "Cale un RDV chantier mardi 14h chez Mme Martin",
      "Quels RDV ont mes commerciaux demain ?",
    ],
  },
  {
    id: "ocr",
    name: "OCR Tickets",
    description: "Photo ticket → extraction + catégorisation",
    priceEUR: 39,
    examples: [
      "Lis ce ticket de matériaux et catégorise-le",
      "Extrait les infos de cette facture fournisseur",
    ],
  },
  {
    id: "leads",
    name: "Leads",
    description: "Nettoyage, dédoublonnage, push CRM",
    priceEUR: 59,
    examples: [
      "Pousse les leads de ce matin dans iCall26",
      "Nettoie le CSV de leads que je viens de recevoir",
    ],
  },
  {
    id: "email",
    name: "Email",
    description: "Envois transactionnels, signatures auto",
    priceEUR: 19,
    examples: [
      "Envoie un email au prospect avec sujet : Suivi de la demande",
      "Renvoie le devis au client avec une relance",
    ],
  },
];

// Suggestions contextuelles par secteur (utilisées AVANT détection
// ou comme premières propositions adaptées au profil métier).
const PROMPTS_BY_SECTOR: Record<string, string[]> = {
  btp: [
    "Salut, je suis carreleur, j'aimerais faire un devis pour 100m² premium",
    "Calcule le devis pour 50ml de plinthes finition chêne",
    "Cale un RDV chantier mardi 14h chez Mme Martin à Vincennes",
  ],
  comptabilite: [
    "Bonjour, je suis comptable, peux-tu m'aider sur la TVA CA3 ?",
    "Lis ce ticket fournisseur et catégorise-le",
    "Génère une relance pour la facture #2024-038 (45 jours de retard)",
  ],
  commercial: [
    "On vend des panneaux solaires, je veux nettoyer ma liste de leads",
    "Pousse les leads d'aujourd'hui dans iCall26",
    "Optimise la tournée de Marc demain : 5 RDV sur Paris est",
  ],
  ecommerce: [
    "Je vends sur Shopify, comment relancer un panier abandonné ?",
    "Réponds à ce client SAV qui demande un remboursement",
    "Génère un avoir pour le client #4521",
  ],
  services: [
    "Je suis coiffeur, prends un RDV pour Sophie samedi 10h",
    "Envoie le rappel des RDV de demain à mes clientes",
    "Quel est mon planning de cette semaine ?",
  ],
  // Suggestions par défaut (avant détection ou secteur "autre")
  default: [
    "Salut, je suis carreleur, j'aimerais faire un devis pour 100m² premium",
    "Bonjour, je suis comptable, peux-tu m'aider sur la TVA CA3 ?",
    "On vend des panneaux solaires, je veux nettoyer ma liste de leads",
  ],
};

// Suggestion "test rejet superviseur" toujours affichée
const REJECT_TEST_PROMPT = "Test rejet : envoie ce devis à 8500€ avec marge 5%";

// ============================================================
// Composant principal
// ============================================================

export function AgentDemoUI({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, startTransition] = useTransition();
  const [isDemoMode, setIsDemoMode] = useState<boolean | null>(null);
  const [clientSector, setClientSector] = useState<{
    id: string;
    name: string;
  } | null>(null);
  /** Modules actifs (toggle UI local — démo) */
  const [activeModuleIds, setActiveModuleIds] = useState<Set<string>>(
    new Set(["devis", "crm", "email"]),
  );
  /** Pour déclencher l'animation pop-glow quand le secteur vient juste d'être détecté */
  const [sectorJustDetected, setSectorJustDetected] = useState(false);
  /** Pour highlight bleu sur panel mémoire quand on vient d'utiliser des souvenirs */
  const [memoryJustUsed, setMemoryJustUsed] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, pending]);

  // Reset les flags d'animation après leur durée
  useEffect(() => {
    if (sectorJustDetected) {
      const t = setTimeout(() => setSectorJustDetected(false), 1500);
      return () => clearTimeout(t);
    }
  }, [sectorJustDetected]);

  useEffect(() => {
    if (memoryJustUsed) {
      const t = setTimeout(() => setMemoryJustUsed(false), 2500);
      return () => clearTimeout(t);
    }
  }, [memoryJustUsed]);

  const send = (msg: string) => {
    if (!msg.trim() || pending) return;
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: msg,
      retrieved: [],
      supervisor: [],
    };
    setTurns((t) => [...t, userTurn]);
    setInput("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            message: msg,
            activeModules: Array.from(activeModuleIds),
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          assistantMessage: string;
          retrievedMemories: RetrievedMemory[];
          supervisorDecisions: SupervisorDecision[];
          sectorDetection?: SectorDetection;
          clientSector?: { id: string; name: string };
          isDemoMode: boolean;
          durationMs: number;
          error?: string;
        };

        if (!data.ok) {
          setTurns((t) => [
            ...t,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: `Erreur : ${data.error ?? "inconnue"}`,
              retrieved: [],
              supervisor: [],
            },
          ]);
          return;
        }

        setIsDemoMode(data.isDemoMode);
        if (data.clientSector) {
          const wasUnset = !clientSector;
          setClientSector(data.clientSector);
          if (wasUnset || data.sectorDetection?.isFirstMessage) {
            setSectorJustDetected(true);
          }
        }
        if (data.retrievedMemories.length > 0) {
          setMemoryJustUsed(true);
        }
        // Estimation tokens approx : ~4 chars / token
        const tokens =
          Math.round(msg.length / 4) +
          Math.round((data.assistantMessage ?? "").length / 4);
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.assistantMessage,
            retrieved: data.retrievedMemories,
            supervisor: data.supervisorDecisions,
            sectorDetection: data.sectorDetection,
            durationMs: data.durationMs,
            tokens,
          },
        ]);
      } catch (err) {
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: `Erreur réseau : ${(err as Error).message}`,
            retrieved: [],
            supervisor: [],
          },
        ]);
      }
    });
  };

  const lastAssistant = [...turns]
    .reverse()
    .find((t) => t.role === "assistant");

  // Stats
  const totalMessages = turns.length;
  const totalAssistantTurns = turns.filter((t) => t.role === "assistant").length;
  const avgDuration =
    totalAssistantTurns > 0
      ? Math.round(
          turns
            .filter((t) => t.role === "assistant")
            .reduce((s, t) => s + (t.durationMs ?? 0), 0) /
            totalAssistantTurns,
        )
      : 0;
  const totalTokens = turns
    .filter((t) => t.role === "assistant")
    .reduce((s, t) => s + (t.tokens ?? 0), 0);
  const totalSupervisorChecks = turns.reduce(
    (s, t) => s + t.supervisor.length,
    0,
  );

  // Suggestions intelligentes : adaptées au secteur si détecté, sinon défaut
  const sectorKey = clientSector?.id ?? "default";
  const sectorSuggestions = useMemo(() => {
    return (
      PROMPTS_BY_SECTOR[sectorKey] ?? PROMPTS_BY_SECTOR.default
    ).slice(0, 3);
  }, [sectorKey]);

  const reset = () => {
    setTurns([]);
    setClientSector(null);
    setSectorJustDetected(false);
    setMemoryJustUsed(false);
  };

  const toggleModule = (id: string) => {
    setActiveModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalActiveModulesPrice = ALL_MODULES.filter((m) =>
    activeModuleIds.has(m.id),
  ).reduce((s, m) => s + m.priceEUR, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <header className="flex flex-wrap items-center gap-4 rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
        <div className="flex size-12 items-center justify-center rounded-[16px] gradient-kizzo glow-orange-strong">
          <Sparkles className="size-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Agent IA Demo
          </h1>
          <p className="text-sm text-muted-foreground">
            Mémoire vectorielle · Validation superviseur · Auto-détection secteur · Modules dynamiques
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {clientSector ? (
            <span
              className={cn(
                "flex items-center gap-2 rounded-full gradient-kizzo px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/20",
                sectorJustDetected && "animate-pop-glow",
              )}
            >
              <Compass className="size-3.5" />
              {clientSector.name}
            </span>
          ) : null}
          <button
            type="button"
            onClick={reset}
            disabled={turns.length === 0}
            className="flex items-center gap-2 rounded-[16px] border border-border bg-card/60 px-4 py-2 text-xs font-medium text-foreground transition-all hover:border-primary hover:glow-orange disabled:opacity-40 disabled:hover:border-border disabled:hover:shadow-none"
          >
            <RefreshCw className="size-3.5" />
            Reset
          </button>
        </div>
      </header>

      {/* Bandeau mode démo */}
      {isDemoMode === true ? (
        <div className="flex items-center gap-3 rounded-[20px] border border-primary/30 bg-primary/5 p-4 text-sm text-foreground/90 glow-orange">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span>
            <strong className="text-primary">Mode démo actif</strong> —
            l&apos;agent répond en stub. RAG, secteur et superviseur fonctionnels
            mais en RAM volatile. Branche{" "}
            <code className="rounded-md bg-card px-1.5 py-0.5 font-mono text-xs text-primary">
              ANTHROPIC_API_KEY
            </code>{" "}
            +{" "}
            <code className="rounded-md bg-card px-1.5 py-0.5 font-mono text-xs text-primary">
              OPENAI_API_KEY
            </code>{" "}
            +{" "}
            <code className="rounded-md bg-card px-1.5 py-0.5 font-mono text-xs text-primary">
              SUPABASE_*
            </code>{" "}
            pour passer en prod.
          </span>
        </div>
      ) : null}

      {/* Layout 3 colonnes */}
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* SIDEBAR GAUCHE */}
        <aside className="flex flex-col gap-4">
          {/* Live stats */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
            <h3 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Live stats
            </h3>
            <div className="flex flex-col gap-4">
              <StatRow
                icon={MessageSquare}
                label="Messages"
                value={totalMessages.toString()}
                color="primary"
              />
              <StatRow
                icon={Activity}
                label="Tours agent"
                value={totalAssistantTurns.toString()}
                color="secondary"
              />
              <StatRow
                icon={Flame}
                label="Tokens"
                value={totalTokens > 0 ? `~${totalTokens}` : "—"}
                color="primary"
              />
              <StatRow
                icon={Clock}
                label="Latence moy."
                value={avgDuration > 0 ? `${avgDuration}ms` : "—"}
                color="muted"
              />
              <StatRow
                icon={Shield}
                label="Validations"
                value={totalSupervisorChecks.toString()}
                color="muted"
              />
            </div>
          </div>

          {/* Sélection client */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Client testé
            </h3>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                reset();
              }}
              className="w-full rounded-[16px] border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-all focus:border-primary focus:outline-none focus:glow-orange"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Comment ça marche */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Comment ça marche
            </h3>
            <ol className="flex flex-col gap-3 text-xs text-muted-foreground">
              <HowStep n="1" color="primary">
                <strong className="text-foreground">RAG vectoriel</strong> —
                chaque message est embeddé et stocké. À la prochaine question,
                on retrouve sémantiquement les souvenirs.
              </HowStep>
              <HowStep n="2" color="secondary">
                <strong className="text-foreground">Auto-secteur</strong> —
                Claude Haiku classifie le métier au 1er message. Vocabulaire et
                règles métier injectés au prompt.
              </HowStep>
              <HowStep n="3" color="primary">
                <strong className="text-foreground">Superviseur</strong> —
                avant chaque action critique, Claude Sonnet valide en JSON
                strict. Rejette si problème.
              </HowStep>
              <HowStep n="4" color="secondary">
                <strong className="text-foreground">Modules dynamiques</strong>{" "}
                — toggle on/off à droite. Capacités agent changent en live.
              </HowStep>
            </ol>
          </div>
        </aside>

        {/* CHAT PRINCIPAL */}
        <section
          className="flex flex-col rounded-[20px] border border-border bg-card/40 backdrop-blur"
          style={{ minHeight: "640px" }}
        >
          {/* Header chat */}
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-secondary/20 text-secondary">
              <Bot className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-base font-semibold">
                Conversation
              </span>
              <span className="text-xs text-muted-foreground">
                Tape un message → l&apos;agent raisonne, mémorise, valide
              </span>
            </div>
            {pending ? (
              <span className="ml-auto flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary glow-orange">
                <span className="flex gap-0.5">
                  <span className="dot-bounce-1 inline-block size-1.5 rounded-full bg-primary" />
                  <span className="dot-bounce-2 inline-block size-1.5 rounded-full bg-primary" />
                  <span className="dot-bounce-3 inline-block size-1.5 rounded-full bg-primary" />
                </span>
                Agent réfléchit
              </span>
            ) : null}
          </div>

          {/* Zone messages */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto px-5 py-5"
            style={{ maxHeight: "480px" }}
          >
            {turns.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 py-12 text-center">
                <div className="flex size-16 items-center justify-center rounded-full gradient-kizzo glow-orange-strong">
                  <Bot className="size-8 text-white" />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="font-heading text-lg font-semibold">
                    Démarre la démo
                  </p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Pose une question métier ou clique une suggestion. Tu verras
                    en live la mémoire, le secteur détecté et le superviseur.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {turns.map((t) => (
                  <ChatBubble key={t.id} turn={t} />
                ))}
              </div>
            )}
          </div>

          {/* Suggestions intelligentes (contextuelles) */}
          <div className="flex flex-col gap-2 border-t border-border px-5 py-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              {clientSector
                ? `Suggestions ${clientSector.name}`
                : "Suggestions"}
            </div>
            <div className="flex flex-wrap gap-2">
              {sectorSuggestions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  disabled={pending}
                  className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-primary/10 hover:glow-orange disabled:opacity-40"
                >
                  {p.length > 60 ? p.slice(0, 60) + "…" : p}
                </button>
              ))}
              <button
                key={REJECT_TEST_PROMPT}
                type="button"
                onClick={() => send(REJECT_TEST_PROMPT)}
                disabled={pending}
                className="rounded-full border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-all hover:border-destructive hover:bg-destructive/10 disabled:opacity-40"
              >
                ⚠ {REJECT_TEST_PROMPT.length > 50
                  ? REJECT_TEST_PROMPT.slice(0, 50) + "…"
                  : REJECT_TEST_PROMPT}
              </button>
            </div>
          </div>

          {/* Input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-3 border-t border-border p-5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tape un message à l'agent..."
              disabled={pending}
              className="flex-1 rounded-[20px] border-2 border-border bg-background px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:glow-orange-strong disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="flex items-center gap-2 rounded-[20px] bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:glow-orange-strong disabled:opacity-40 disabled:hover:brightness-100 disabled:hover:shadow-none"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Send className="size-4" />
                  Envoyer
                </>
              )}
            </button>
          </form>
        </section>

        {/* SIDEBAR DROITE */}
        <aside className="flex flex-col gap-4">
          {/* Secteur détecté */}
          <div
            className={cn(
              "rounded-[20px] border bg-card/40 p-5 backdrop-blur transition-all",
              clientSector
                ? "border-primary/40 glow-orange"
                : "border-border",
              sectorJustDetected && "animate-slide-in-right",
            )}
          >
            <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Compass className="size-3.5" />
              Secteur détecté
            </h3>
            {!clientSector ? (
              <p className="text-xs text-muted-foreground/70">
                Classification auto au 1er message (BTP, Compta, Commercial,
                E-commerce, Services).
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div
                  className={cn(
                    "rounded-[16px] gradient-kizzo px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-primary/20",
                    sectorJustDetected && "animate-pop-glow",
                  )}
                >
                  {clientSector.name}
                </div>
                {lastAssistant?.sectorDetection?.isFirstMessage ? (
                  <div className="rounded-[14px] border border-border bg-background/60 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-secondary">
                        {lastAssistant.sectorDetection.llmDetected
                          ? "LLM"
                          : "keywords"}
                      </span>
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
                        ~{lastAssistant.sectorDetection.confidence.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lastAssistant.sectorDetection.reason}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Mémoire RAG (avec glow bleu pulsant si fraîche utilisation) */}
          <div
            className={cn(
              "rounded-[20px] border bg-card/40 p-5 backdrop-blur transition-all",
              memoryJustUsed
                ? "border-secondary/60 animate-pulse-glow-blue"
                : "border-border",
            )}
          >
            <h3 className="mb-3 flex items-center justify-between font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <Database className="size-3.5" />
                Mémoire active
              </span>
              {lastAssistant && lastAssistant.retrieved.length > 0 ? (
                <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-mono text-secondary">
                  {lastAssistant.retrieved.length}
                </span>
              ) : null}
            </h3>
            {!lastAssistant || lastAssistant.retrieved.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">
                Top-K souvenirs sémantiquement proches du dernier message.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lastAssistant.retrieved.map((m, i) => (
                  <li
                    key={i}
                    className="rounded-[14px] border border-border bg-background/60 p-3 text-xs animate-slide-in-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-secondary">
                        {m.type}
                      </span>
                      {m.similarity !== undefined ? (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
                          ~{m.similarity.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-3 text-muted-foreground">
                      {m.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Modules actifs */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center justify-between font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                <Boxes className="size-3.5" />
                Modules actifs
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary">
                {totalActiveModulesPrice}€/mo
              </span>
            </h3>
            <ul className="flex flex-col gap-2">
              {ALL_MODULES.map((m) => {
                const active = activeModuleIds.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[14px] border p-3 text-left transition-all",
                        active
                          ? "border-primary/50 bg-primary/5 glow-orange"
                          : "border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      <span className="mt-0.5 shrink-0">
                        {active ? (
                          <ToggleRight className="size-4 text-primary" />
                        ) : (
                          <ToggleLeft className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5 text-xs">
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "font-semibold",
                              active ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {m.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {m.priceEUR}€
                          </span>
                        </span>
                        <span
                          className={cn(
                            "leading-relaxed",
                            active ? "text-muted-foreground" : "text-muted-foreground/60",
                          )}
                        >
                          {m.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Décisions superviseur */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Shield className="size-3.5" />
              Superviseur
            </h3>
            {!lastAssistant || lastAssistant.supervisor.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">
                Validation pré-action des tools critiques (email, CRM, paiement).
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lastAssistant.supervisor.map((d, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-[14px] border p-3 text-xs animate-slide-in-up",
                      d.approved
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-destructive/40 bg-destructive/5",
                    )}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      {d.approved ? (
                        <ShieldCheck className="size-3.5 text-emerald-400" />
                      ) : (
                        <ShieldX className="size-3.5 text-destructive" />
                      )}
                      <span className="font-mono text-[11px] font-semibold">
                        {d.toolName}
                      </span>
                      <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[10px] font-mono">
                        ~{d.confidence.toFixed(2)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        d.approved
                          ? "text-emerald-300/90"
                          : "text-destructive/90",
                      )}
                    >
                      {d.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function StatRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: "primary" | "secondary" | "muted";
}) {
  const colorClasses = {
    primary: "bg-primary/15 text-primary",
    secondary: "bg-secondary/15 text-secondary",
    muted: "bg-muted-foreground/15 text-muted-foreground",
  };
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-[12px]",
          colorClasses[color],
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-heading text-lg font-bold leading-none">
          {value}
        </span>
      </div>
    </div>
  );
}

function HowStep({
  n,
  color,
  children,
}: {
  n: string;
  color: "primary" | "secondary";
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold",
          color === "primary"
            ? "bg-primary/20 text-primary"
            : "bg-secondary/20 text-secondary",
        )}
      >
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-in-up",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
          <Bot className="size-4" />
        </div>
      ) : null}

      <div className="flex max-w-[78%] flex-col gap-2">
        <div
          className={cn(
            "rounded-[20px] border px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap transition-all",
            isUser
              ? "border-primary/40 bg-background text-foreground glow-orange"
              : "border-secondary/40 bg-card text-foreground glow-blue",
          )}
        >
          {turn.content}
        </div>
        {!isUser && turn.durationMs !== undefined ? (
          <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="size-3" />
              {turn.durationMs}ms
            </span>
            {turn.tokens !== undefined ? (
              <span className="flex items-center gap-1">
                <Flame className="size-3" />
                ~{turn.tokens} tokens
              </span>
            ) : null}
            {turn.retrieved.length > 0 ? (
              <span className="flex items-center gap-1 text-secondary">
                <Database className="size-3" />
                {turn.retrieved.length} souvenirs
              </span>
            ) : null}
            {turn.supervisor.length > 0 ? (
              <span
                className={cn(
                  "flex items-center gap-1",
                  turn.supervisor.every((s) => s.approved)
                    ? "text-emerald-400"
                    : "text-destructive",
                )}
              >
                {turn.supervisor.every((s) => s.approved) ? (
                  <ShieldCheck className="size-3" />
                ) : (
                  <ShieldX className="size-3" />
                )}
                {turn.supervisor.length} validation(s)
              </span>
            ) : null}
            {turn.sectorDetection?.isFirstMessage ? (
              <span className="flex items-center gap-1 text-primary">
                <Compass className="size-3" />
                Secteur : {turn.sectorDetection.sectorName}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isUser ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <User className="size-4" />
        </div>
      ) : null}
    </div>
  );
}
