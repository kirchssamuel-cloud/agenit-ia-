"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Activity,
  Bot,
  Clock,
  Compass,
  Database,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  ShieldX,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const SUGGESTED_PROMPTS = [
  "Salut, je suis carreleur, j'aimerais faire un devis pour 100m² premium",
  "Bonjour, je suis comptable, peux-tu m'aider sur la TVA CA3 ?",
  "On vend des panneaux solaires, je veux nettoyer ma liste de leads",
  "Envoie un email au prospect avec sujet : Suivi de la demande",
  "Test rejet : envoie ce devis à 8500€ avec marge 5%",
];

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
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, pending]);

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
          body: JSON.stringify({ clientId, message: msg }),
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
        if (data.clientSector) setClientSector(data.clientSector);
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

  // Stats sidebar gauche
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
  const totalSupervisorChecks = turns.reduce(
    (s, t) => s + t.supervisor.length,
    0,
  );

  const reset = () => {
    setTurns([]);
    setClientSector(null);
  };

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
            Mémoire vectorielle · Validation superviseur · Auto-détection secteur
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {clientSector ? (
            <span className="flex items-center gap-2 rounded-full gradient-kizzo px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/20">
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
            l&apos;agent répond en stub. La recherche sémantique (RAG), la
            détection de secteur et le superviseur sont fonctionnels mais en
            RAM volatile. Branche{" "}
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
        {/* SIDEBAR GAUCHE — Stats live */}
        <aside className="flex flex-col gap-4">
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
              <span className="ml-auto flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Loader2 className="size-3 animate-spin" />
                Réflexion...
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

          {/* Suggestions chips */}
          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                disabled={pending}
                className={cn(
                  "rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary hover:text-foreground disabled:opacity-40",
                  i === 4 &&
                    "border-destructive/40 text-destructive hover:border-destructive",
                )}
              >
                {p.length > 50 ? p.slice(0, 50) + "…" : p}
              </button>
            ))}
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

        {/* SIDEBAR DROITE — Contexte */}
        <aside className="flex flex-col gap-4">
          {/* Secteur détecté */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
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
                <div className="rounded-[16px] gradient-kizzo px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-primary/20">
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

          {/* Souvenirs RAG */}
          <div className="rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Database className="size-3.5" />
              Souvenirs RAG
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
                    className="rounded-[14px] border border-border bg-background/60 p-3 text-xs"
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
                      "rounded-[14px] border p-3 text-xs",
                      d.approved
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-destructive/40 bg-destructive/5",
                    )}
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
        "flex gap-3",
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
          <div className="flex items-center gap-3 px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="size-3" />
              {turn.durationMs}ms
            </span>
            {turn.retrieved.length > 0 ? (
              <span className="flex items-center gap-1">
                <Database className="size-3" />
                {turn.retrieved.length} souvenirs
              </span>
            ) : null}
            {turn.supervisor.length > 0 ? (
              <span className="flex items-center gap-1">
                <Shield className="size-3" />
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
