"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Bot, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  toolUses?: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    isError: boolean;
  }>;
  costCents?: number;
}

interface ClientOption {
  id: string;
  name: string;
}

export function AgentTestChat({ clients }: { clients: ClientOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  const send = async () => {
    if (!input.trim() || pending) return;
    const userMsg = input.trim();
    setInput("");
    setError(null);
    setTurns((prev) => [...prev, { role: "user", text: userMsg }]);
    setPending(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          conversationId,
          message: userMsg,
        }),
      });
      const data = (await res.json()) as
        | {
            ok: true;
            conversationId: string;
            assistantMessage: string;
            toolUses: ChatTurn["toolUses"];
            costCents: number;
          }
        | { ok: false; error: string };

      if (!data.ok) {
        setError(data.error);
        return;
      }

      setConversationId(data.conversationId);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.assistantMessage,
          toolUses: data.toolUses,
          costCents: data.costCents,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  const resetConversation = () => {
    setConversationId(null);
    setTurns([]);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" />
              Tester l&apos;agent (chat web)
            </CardTitle>
            <CardDescription>
              Discute avec ton agent. Il utilise les compétences enseignées + les modules
              activés du client sélectionné.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                resetConversation();
              }}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={resetConversation}>
              Nouveau chat
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="flex max-h-[480px] flex-col gap-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-4"
        >
          {turns.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Pas encore d&apos;échange. Tape un message pour commencer.
            </p>
          ) : (
            turns.map((t, i) => (
              <div
                key={i}
                className={`flex gap-2 ${t.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                    t.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {t.role === "user" ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>
                <div
                  className={`flex max-w-[80%] flex-col gap-1.5 rounded-lg px-3 py-2 text-sm ${
                    t.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{t.text}</p>
                  {t.toolUses && t.toolUses.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-1 border-t border-border/50 pt-1.5">
                      {t.toolUses.map((tu, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-1.5 text-xs opacity-80"
                        >
                          <Wrench className="size-3" />
                          <span className="font-mono">{tu.toolName}</span>
                          {tu.isError ? (
                            <Badge variant="destructive" className="h-4 text-[10px]">
                              erreur
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="h-4 text-[10px]">
                              ok
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {t.costCents != null && t.role === "assistant" ? (
                    <span className="text-[10px] text-muted-foreground">
                      ~{(t.costCents / 100).toFixed(4)} $
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {pending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              L&apos;agent réfléchit...
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="msg" className="sr-only">
              Message
            </Label>
            <textarea
              id="msg"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Demande à ton agent... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
              disabled={pending}
            />
          </div>
          <Button onClick={send} disabled={pending || !input.trim()}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
