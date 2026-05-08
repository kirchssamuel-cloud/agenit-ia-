"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import {
  Bot,
  Brain,
  Check,
  Database,
  Loader2,
  Send,
  Shield,
  ShieldX,
  Sparkles,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  retrieved: RetrievedMemory[];
  supervisor: SupervisorDecision[];
  durationMs?: number;
}

const SUGGESTED_PROMPTS = [
  "Génère-moi un devis pour 100m² de carrelage premium, marge 30%",
  "Envoie-moi le rapport de la semaine par mail",
  "Pousse les leads de ce matin dans iCall26",
  "Quels RDV ont mes commerciaux demain ?",
  "Test rejet : envoie ce devis à 8500€ avec marge 5%",
];

export function AgentDemoUI({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, startTransition] = useTransition();
  const [isDemoMode, setIsDemoMode] = useState<boolean | null>(null);
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
        setTurns((t) => [
          ...t,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.assistantMessage,
            retrieved: data.retrievedMemories,
            supervisor: data.supervisorDecisions,
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

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau mode démo */}
      {isDemoMode === true ? (
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <Sparkles className="size-4 text-amber-600" />
            <span>
              <strong>Mode démo actif</strong> — l&apos;agent répond avec des
              stubs réalistes. La recherche sémantique (RAG) et le superviseur
              fonctionnent vraiment, mais en mémoire RAM (volatile). Branche
              <code className="mx-1 rounded bg-amber-100 px-1 text-amber-800">
                ANTHROPIC_API_KEY
              </code>
              et Supabase pour passer en mode prod réel.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* Sélecteur client */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Label htmlFor="clientId" className="shrink-0">
            Client
          </Label>
          <select
            id="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setTurns([]);
            }}
            className="h-9 flex-1 max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.industry ? `— ${c.industry}` : ""}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTurns([])}
            disabled={turns.length === 0}
          >
            Reset chat
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Colonne gauche : conversation */}
        <Card className="flex flex-col" style={{ minHeight: "560px" }}>
          <CardHeader className="border-b border-border py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4" /> Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto px-4 py-3"
              style={{ maxHeight: "420px" }}
            >
              {turns.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center text-sm text-muted-foreground">
                  <Bot className="size-8 text-muted-foreground/40" />
                  <p>Démarre une conversation pour voir l&apos;agent en action.</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {SUGGESTED_PROMPTS.slice(0, 3).map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="rounded-md border border-border bg-card px-3 py-2 text-xs hover:bg-accent"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {turns.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex gap-2",
                        t.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {t.role === "assistant" ? (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Bot className="size-4" />
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                          t.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        {t.content}
                        {t.durationMs !== undefined ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {t.durationMs}ms · {t.retrieved.length} souvenirs ·{" "}
                            {t.supervisor.length} décision(s) superviseur
                          </div>
                        ) : null}
                      </div>
                      {t.role === "user" ? (
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                          <User className="size-4" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {pending ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      L&apos;agent réfléchit...
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Suggestions + input */}
            <div className="border-t border-border p-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    disabled={pending}
                    className="rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Tape un message à l'agent..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={pending}
                  className="flex-1"
                />
                <Button type="submit" disabled={pending || !input.trim()}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Colonne droite : panneaux contextuels */}
        <div className="flex flex-col gap-4">
          {/* Souvenirs retrouvés (RAG) */}
          <Card>
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4" /> Souvenirs retrouvés (RAG)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {!lastAssistant || lastAssistant.retrieved.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  La recherche sémantique top-K affichera ici les souvenirs
                  pertinents pour le dernier message.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-xs">
                  {lastAssistant.retrieved.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-muted/30 p-2"
                    >
                      <div className="mb-1 flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {m.type}
                        </Badge>
                        {m.similarity !== undefined ? (
                          <Badge variant="secondary" className="text-[10px]">
                            ~{m.similarity.toFixed(2)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="line-clamp-3 text-muted-foreground">
                        {m.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Décisions superviseur */}
          <Card>
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4" /> Décisions superviseur
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {!lastAssistant || lastAssistant.supervisor.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Quand l&apos;agent veut envoyer un email ou pousser dans le
                  CRM, le superviseur valide ici.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-xs">
                  {lastAssistant.supervisor.map((d, i) => (
                    <li
                      key={i}
                      className={cn(
                        "rounded-md border p-2",
                        d.approved
                          ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-rose-500/40 bg-rose-50 dark:bg-rose-950/30",
                      )}
                    >
                      <div className="mb-1 flex items-center gap-1">
                        {d.approved ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <ShieldX className="size-3 text-rose-600" />
                        )}
                        <span className="font-mono font-semibold">
                          {d.toolName}
                        </span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          ~{d.confidence.toFixed(2)}
                        </Badge>
                      </div>
                      <p
                        className={cn(
                          "text-muted-foreground",
                          d.approved
                            ? "text-emerald-800 dark:text-emerald-300"
                            : "text-rose-800 dark:text-rose-300",
                        )}
                      >
                        {d.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Aide */}
          <Card>
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="size-4" /> Comment ça marche
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3 text-xs text-muted-foreground">
              <p>
                <strong>1. Mémoire vectorielle</strong> — chaque message est
                vectorisé et stocké. À la prochaine question, on retrouve
                sémantiquement les souvenirs pertinents (RAG).
              </p>
              <p>
                <strong>2. Agent Principal</strong> — Claude Opus 4.7 reçoit le
                message + souvenirs + tools, raisonne et propose des actions.
              </p>
              <p>
                <strong>3. Agent Superviseur</strong> — avant chaque action
                critique (email, CRM), Claude Sonnet 4.7 valide la cohérence en
                un appel séparé. Rejette si problème.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
