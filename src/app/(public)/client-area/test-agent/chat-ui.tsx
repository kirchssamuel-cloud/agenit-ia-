"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Loader2, Wrench, AlertTriangle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
  toolUses?: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    isError: boolean;
  }>;
}

interface ChatResponse {
  ok: boolean;
  conversationId?: string;
  assistantMessage?: string;
  toolUses?: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    isError: boolean;
  }>;
  costCents?: number;
  durationMs?: number;
  error?: string;
  hint?: string;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ChatUI({ clientId, clientName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll en bas à chaque nouveau message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setPending(true);

    try {
      const res = await fetch("/api/agent-web/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          userMessage: text,
          conversationId,
        }),
      });
      const data = (await res.json()) as ChatResponse;

      if (!data.ok) {
        const errMsg = data.error ?? "Erreur inconnue";
        setError(data.hint ? `${errMsg} — ${data.hint}` : errMsg);
        return;
      }

      setConversationId(data.conversationId);
      setLastCost(data.costCents ?? null);
      setLastDuration(data.durationMs ?? null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.assistantMessage ?? "",
          toolUses: data.toolUses,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
      // Refocus input pour fluidité
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="bg-[#1E293B] rounded-2xl border border-slate-700 overflow-hidden">
      {/* Zone messages */}
      <div
        ref={scrollRef}
        className="h-96 sm:h-[28rem] overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-12 text-sm">
            <p>Commence la discussion avec ton agent.</p>
            <p className="text-xs mt-2">
              Essaie : « Lis mes 3 derniers emails » ou « Note un RDV demain
              14h avec Marc »
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}

        {pending && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="animate-spin" size={14} />
            <span>{clientName.split(" ")[0]}&apos;s agent réfléchit…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm flex items-start gap-2">
            <AlertTriangle
              size={16}
              className="text-red-400 flex-shrink-0 mt-0.5"
            />
            <div>
              <div className="font-medium text-red-300">Erreur</div>
              <div className="text-slate-300 text-xs mt-0.5">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      {(lastCost !== null || lastDuration !== null) && (
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-800 flex gap-4">
          {lastDuration !== null && (
            <span>⏱ {(lastDuration / 1000).toFixed(1)}s</span>
          )}
          {lastCost !== null && (
            <span>💰 {(lastCost / 100).toFixed(3)}€</span>
          )}
          {conversationId && (
            <span className="font-mono text-[10px] truncate ml-auto">
              {conversationId.slice(0, 8)}…
            </span>
          )}
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-3 border-t border-slate-700 bg-[#0F172A]"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          placeholder="Écris à ton agent…"
          className="flex-1 bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F97316] disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="bg-[#F97316] hover:bg-[#F97316]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          Envoyer
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] bg-[#F97316] text-white rounded-2xl rounded-tr-md px-4 py-2 text-sm"
            : "max-w-[85%] bg-[#0F172A] border border-slate-700 text-white rounded-2xl rounded-tl-md px-4 py-2 text-sm"
        }
      >
        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        {msg.toolUses && msg.toolUses.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
            {msg.toolUses.map((tu, i) => (
              <details key={i} className="text-xs">
                <summary className="cursor-pointer text-slate-400 hover:text-white flex items-center gap-1">
                  <Wrench size={12} />
                  <code
                    className={
                      tu.isError ? "text-red-400" : "text-emerald-400"
                    }
                  >
                    {tu.toolName}
                  </code>
                  {tu.isError && (
                    <span className="text-red-400 text-[10px]">ERROR</span>
                  )}
                </summary>
                <div className="mt-1 ml-4 space-y-1 text-slate-400 font-mono text-[10px]">
                  <div>
                    <span className="text-slate-500">input:</span>{" "}
                    <span className="break-all">
                      {JSON.stringify(tu.input).slice(0, 200)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">output:</span>{" "}
                    <span className="break-all">
                      {JSON.stringify(tu.output).slice(0, 200)}
                    </span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
