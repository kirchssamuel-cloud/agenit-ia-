import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { TOOL_REGISTRY, getToolById } from "./tools/registry";
import type { AnyTool, ToolContext } from "./tools/types";
import {
  appendMessage,
  createConversation,
  getConversation,
  listMessages,
  listClientFacts,
  type Message,
} from "@/lib/db/agent-brain";
import { listSkills, type AgentSkill } from "@/lib/db/agent-skills";
import { ensureLoaded, getClient, listClientModules } from "@/lib/db/store";
import { MODULE_REGISTRY, getModuleById } from "@/modules/registry";
import {
  retrieveMemories,
  storeMemory,
  getClientContext,
  type MemoryEntry,
  type ClientContext,
} from "@/lib/db/agent-memory";
import { superviseToolCall } from "./supervisor";

// ============================================================
// Types
// ============================================================

export interface BrainChatInput {
  clientId: string;
  conversationId?: string;
  /** Message texte du user (canal: web pour l'instant) */
  userMessage: string;
  channel?: "web" | "whatsapp" | "email" | "api";
}

export interface BrainChatOutput {
  conversationId: string;
  assistantMessage: string;
  toolUses: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    isError: boolean;
  }>;
  costCents: number;
  tokensIn: number;
  tokensOut: number;
}

// ============================================================
// Tool catalog → Claude tools format
// ============================================================

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Conversion minimale Zod → JSON Schema. Pour les cas simples ça marche.
  // Pour les cas complexes on remplacera par zod-to-json-schema plus tard.
  const def = schema._def as { typeName?: string };
  if (def.typeName === "ZodObject") {
    const obj = schema as unknown as z.ZodObject<z.ZodRawShape>;
    const shape = obj.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, sub] of Object.entries(shape)) {
      const subZ = sub as z.ZodTypeAny;
      properties[key] = zodToJsonSchema(subZ);
      const subDef = subZ._def as { typeName?: string };
      if (subDef.typeName !== "ZodOptional" && subDef.typeName !== "ZodDefault") {
        required.push(key);
      }
    }
    return { type: "object", properties, required };
  }
  if (def.typeName === "ZodString") return { type: "string" };
  if (def.typeName === "ZodNumber") return { type: "number" };
  if (def.typeName === "ZodBoolean") return { type: "boolean" };
  if (def.typeName === "ZodArray") {
    const arr = schema as unknown as z.ZodArray<z.ZodTypeAny>;
    return { type: "array", items: zodToJsonSchema(arr._def.type) };
  }
  if (def.typeName === "ZodEnum") {
    const en = schema as unknown as z.ZodEnum<[string, ...string[]]>;
    return { type: "string", enum: en._def.values };
  }
  if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault") {
    const inner = (schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def
      .innerType;
    return zodToJsonSchema(inner);
  }
  if (def.typeName === "ZodRecord") return { type: "object" };
  return {}; // fallback
}

function toolToClaudeFormat(tool: AnyTool): Anthropic.Tool {
  const inputSchema = zodToJsonSchema(tool.inputSchema) as Anthropic.Tool["input_schema"];
  return {
    name: tool.id.replace(/-/g, "_"),
    description: tool.description,
    input_schema: inputSchema,
  };
}

// Map nom Claude → tool original
function buildToolMap(tools: AnyTool[]): Map<string, AnyTool> {
  const m = new Map<string, AnyTool>();
  for (const t of tools) m.set(t.id.replace(/-/g, "_"), t);
  return m;
}

// ============================================================
// Sélection des tools dispo pour ce client
// ============================================================

/**
 * Tools toujours disponibles pour l'agent, peu importe les modules activés.
 * Permettent au cerveau de mémoriser, proposer des skills, et se réparer.
 */
const ALWAYS_AVAILABLE_TOOLS = new Set<string>([
  "remember-fact",
  "propose-learning",
  "run-module",
]);

function getAvailableToolsForClient(clientId: string): AnyTool[] {
  const cms = listClientModules(clientId).filter((cm) => cm.enabled);
  const allowedToolIds = new Set<string>(ALWAYS_AVAILABLE_TOOLS);
  for (const cm of cms) {
    const mod = getModuleById(cm.moduleId);
    if (!mod) continue;
    for (const tid of mod.tools) allowedToolIds.add(tid);
  }
  return TOOL_REGISTRY.filter(
    (t) => t.exposedToLLM && allowedToolIds.has(t.id),
  );
}

// ============================================================
// Construction du system prompt
// ============================================================

function buildSystemPrompt(opts: {
  clientName: string;
  industry?: string;
  skills: AgentSkill[];
  facts: Awaited<ReturnType<typeof listClientFacts>>;
  /** Souvenirs pertinents retrouvés par recherche sémantique */
  relevantMemories: MemoryEntry[];
  /** Profil enrichi du client (secteur, ton, prefs) */
  context: ClientContext | null;
}): string {
  const lines: string[] = [];
  const ctxSector = opts.context?.sector ?? opts.industry;
  lines.push(
    `Tu es l'agent IA personnel de ${opts.clientName}${ctxSector ? ` (secteur : ${ctxSector})` : ""}.`,
  );
  lines.push("");
  lines.push("Ton rôle : aider le client à exécuter ses tâches métier en utilisant les outils à ta disposition.");
  lines.push("");
  lines.push("Règles :");
  const tone = opts.context?.tone ?? "professionnel";
  lines.push(`- Réponds en français, ton ${tone}.`);
  lines.push("- Utilise les tools quand c'est pertinent (ne demande pas la permission, agis).");
  lines.push("- Si tu manques d'info, demande au client.");
  lines.push("- Confirme toujours les actions critiques (envoi d'email, push CRM) avant de les faire.");
  lines.push("- Garde tes réponses concises (sauf si l'user demande des détails).");

  // Préférences explicites du client
  const prefs = opts.context?.preferences;
  if (prefs && Object.keys(prefs).length > 0) {
    lines.push("");
    lines.push("# Préférences de ce client");
    for (const [k, v] of Object.entries(prefs)) {
      lines.push(`- ${k} : ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }

  if (opts.skills.length > 0) {
    lines.push("");
    lines.push("# Compétences que tu maîtrises (apprises par l'admin)");
    for (const s of opts.skills.filter((sk) => sk.status === "active")) {
      lines.push(`- **${s.name}** : ${s.description ?? "—"}`);
      if (s.triggerPattern) lines.push(`  Déclencheur : ${s.triggerPattern}`);
      if (s.actionTemplate) lines.push(`  Action : ${s.actionTemplate}`);
    }
  }

  if (opts.facts.length > 0) {
    lines.push("");
    lines.push("# Faits que tu sais sur ce client (mémoire long-terme)");
    for (const f of opts.facts) {
      lines.push(`- [${f.category}] ${f.fact}`);
    }
  }

  // Souvenirs pertinents retrouvés sémantiquement (RAG)
  if (opts.relevantMemories.length > 0) {
    lines.push("");
    lines.push("# Souvenirs pertinents pour cette conversation");
    lines.push(
      "(retrouvés par recherche sémantique sur l'historique de ce client)",
    );
    for (const m of opts.relevantMemories) {
      const sim = m.similarity !== undefined ? ` ~${m.similarity.toFixed(2)}` : "";
      lines.push(`- [${m.type}${sim}] ${m.content}`);
    }
  }

  return lines.join("\n");
}

// ============================================================
// Conversion messages DB → format Claude
// ============================================================

function dbMessagesToClaudeMessages(messages: Message[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content ?? "" });
    } else if (m.role === "assistant") {
      // Reconstruction du turn assistant : texte + éventuels tool_use
      const contentBlocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) {
        contentBlocks.push({ type: "text", text: m.content });
      }
      const toolCalls = m.toolCalls as
        | Array<{ id: string; name: string; input: unknown }>
        | null;
      if (toolCalls) {
        for (const tc of toolCalls) {
          contentBlocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input as Record<string, unknown>,
          });
        }
      }
      if (contentBlocks.length > 0) {
        out.push({ role: "assistant", content: contentBlocks });
      }
    } else if (m.role === "tool") {
      // Tool results sont stockés comme messages "tool" en DB,
      // mais doivent partir dans un user-turn côté Claude.
      const toolResults = m.toolResults as
        | Array<{ tool_use_id: string; content: string; is_error?: boolean }>
        | null;
      if (toolResults) {
        out.push({
          role: "user",
          content: toolResults.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.tool_use_id,
            content: r.content,
            is_error: r.is_error ?? false,
          })),
        });
      }
    }
  }
  return out;
}

// ============================================================
// Cœur : la fonction de chat
// ============================================================

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 16_000;
const MAX_AGENT_ITERATIONS = 6;

export async function chatWithAgent(input: BrainChatInput): Promise<BrainChatOutput> {
  await ensureLoaded();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante. Crée une clé sur https://console.anthropic.com/settings/keys et ajoute-la à .env.local.",
    );
  }

  const client = getClient(input.clientId);
  if (!client) throw new Error(`Client introuvable : ${input.clientId}`);

  // 1. Conversation : récupère ou crée
  let conversation = input.conversationId
    ? await getConversation(input.conversationId)
    : null;
  if (!conversation) {
    conversation = await createConversation(
      input.clientId,
      input.channel ?? "web",
    );
  }

  // 2. Charger contexte (skills + facts + history + souvenirs sémantiques + profil)
  const [skills, facts, history, relevantMemories, context] = await Promise.all([
    listSkills().catch(() => [] as AgentSkill[]),
    listClientFacts(input.clientId).catch(() => []),
    listMessages(conversation.id, 30),
    // RAG : top-K souvenirs sémantiquement proches du message user
    retrieveMemories({
      clientId: input.clientId,
      query: input.userMessage,
      limit: 8,
      matchThreshold: 0.7,
    }).catch(() => [] as MemoryEntry[]),
    getClientContext(input.clientId).catch(() => null),
  ]);

  // 3. Append le message user en DB
  await appendMessage({
    conversationId: conversation.id,
    role: "user",
    content: input.userMessage,
  });

  // 4. Construire system + messages + tools
  const systemPrompt = buildSystemPrompt({
    clientName: client.name,
    industry: client.industry,
    skills,
    facts,
    relevantMemories,
    context,
  });

  const claudeMessages: Anthropic.MessageParam[] = [
    ...dbMessagesToClaudeMessages(history),
    { role: "user", content: input.userMessage },
  ];

  const availableTools = getAvailableToolsForClient(input.clientId);
  const toolMap = buildToolMap(availableTools);
  const claudeTools: Anthropic.Tool[] = availableTools.map(toolToClaudeFormat);

  // 5. Boucle agent : tool use loop
  const anthropic = new Anthropic({ apiKey });

  const toolUses: BrainChatOutput["toolUses"] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let assistantText = "";
  let iter = 0;

  while (iter < MAX_AGENT_ITERATIONS) {
    iter++;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // System prompt avec cache_control pour réduire les coûts entre tours
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: claudeTools.length > 0 ? claudeTools : undefined,
      messages: claudeMessages,
    });

    totalTokensIn += response.usage.input_tokens;
    totalTokensOut += response.usage.output_tokens;

    // Extraire le texte de la réponse
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const turnText = textBlocks.map((b) => b.text).join("\n");
    if (turnText) assistantText = turnText;

    // Extraire les tool_use
    const toolCalls = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // Append le turn assistant en DB (avec tool_use s'il y en a)
    await appendMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: turnText || null,
      toolCalls: toolCalls.length > 0
        ? toolCalls.map((tc) => ({ id: tc.id, name: tc.name, input: tc.input }))
        : undefined,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    });

    // Si pas de tool_use, on a fini
    if (response.stop_reason !== "tool_use" || toolCalls.length === 0) {
      break;
    }

    // Push la réponse assistant dans messages pour la prochaine itération
    claudeMessages.push({ role: "assistant", content: response.content });

    // Exécuter chaque tool
    const ctx: ToolContext = {
      clientId: input.clientId,
      runId: randomUUID(),
      log: () => {},
    };

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    const dbToolResults: Array<{
      tool_use_id: string;
      content: string;
      is_error: boolean;
    }> = [];

    for (const tc of toolCalls) {
      const tool = toolMap.get(tc.name);
      if (!tool) {
        const errMsg = `Tool inconnu : ${tc.name}`;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: errMsg,
          is_error: true,
        });
        dbToolResults.push({ tool_use_id: tc.id, content: errMsg, is_error: true });
        toolUses.push({
          toolName: tc.name,
          input: tc.input,
          output: errMsg,
          isError: true,
        });
        continue;
      }

      try {
        const validated = tool.inputSchema.parse(tc.input);

        // Phase 2 : Agent Superviseur — validation pré-action pour les tools
        // critiques (send-email, push-icall26, etc.)
        if (tool.requiresSupervision) {
          const decision = await superviseToolCall({
            clientId: input.clientId,
            conversationId: conversation.id,
            toolId: tool.id,
            toolName: tool.name,
            toolDescription: tool.description,
            input: validated,
            userMessage: input.userMessage,
          });
          if (!decision.approved) {
            const rejectMsg = `[SUPERVISEUR REJETTE] ${decision.reason ?? "raison non précisée"}. Reformule avec correction puis réessaye.`;
            toolResults.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: rejectMsg,
              is_error: true,
            });
            dbToolResults.push({
              tool_use_id: tc.id,
              content: rejectMsg,
              is_error: true,
            });
            toolUses.push({
              toolName: tc.name,
              input: tc.input,
              output: rejectMsg,
              isError: true,
            });
            continue;
          }
        }

        const output = await tool.execute(validated, ctx);
        const outputStr = JSON.stringify(output, null, 2);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: outputStr,
        });
        dbToolResults.push({
          tool_use_id: tc.id,
          content: outputStr,
          is_error: false,
        });
        toolUses.push({
          toolName: tc.name,
          input: tc.input,
          output,
          isError: false,
        });
      } catch (err) {
        const errMsg = (err as Error).message;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: errMsg,
          is_error: true,
        });
        dbToolResults.push({ tool_use_id: tc.id, content: errMsg, is_error: true });
        toolUses.push({
          toolName: tc.name,
          input: tc.input,
          output: errMsg,
          isError: true,
        });
      }
    }

    // Sauve les tool results en DB comme un message "tool"
    await appendMessage({
      conversationId: conversation.id,
      role: "tool",
      toolResults: dbToolResults,
    });

    // Push tool_results pour la prochaine itération Claude
    claudeMessages.push({ role: "user", content: toolResults });
  }

  // Coût approximatif Claude Opus 4.7 : $5/M input, $25/M output
  const costCents = Math.round(
    (totalTokensIn / 1_000_000) * 500 + (totalTokensOut / 1_000_000) * 2_500,
  );

  // ============================================================
  // Persistance mémoire vectorielle (3 entrées par échange)
  // ============================================================
  // On stocke 3 souvenirs distincts pour chaque échange afin de maximiser
  // la qualité du RAG :
  //   1. user_message  → permet de retrouver des questions similaires
  //   2. agent_response → permet de retrouver des réponses passées
  //   3. conversation  → l'échange combiné pour le contexte chronologique
  //
  // Best-effort : si ça échoue (Supabase down, OpenAI quota), on ne bloque
  // pas la réponse. On lance les 3 en parallèle pour minimiser la latence.
  // ============================================================
  const baseMeta = {
    conversationId: conversation.id,
    channel: input.channel ?? "web",
    costCents,
  };
  const memoryWrites = Promise.all([
    storeMemory({
      clientId: input.clientId,
      type: "user_message",
      content: input.userMessage,
      metadata: baseMeta,
      importance: 0.5,
    }),
    storeMemory({
      clientId: input.clientId,
      type: "agent_response",
      content: assistantText || "(pas de réponse)",
      metadata: { ...baseMeta, toolUses: toolUses.map((tu) => tu.toolName) },
      importance: toolUses.length > 0 ? 0.7 : 0.5,
    }),
    storeMemory({
      clientId: input.clientId,
      type: "conversation",
      content: `User : ${input.userMessage}\nAgent : ${assistantText || "(pas de réponse)"}`,
      metadata: { ...baseMeta, toolUses: toolUses.map((tu) => tu.toolName) },
      importance: toolUses.length > 0 ? 0.7 : 0.5,
    }),
  ]).catch((err) => {
    console.error(`[brain] storeMemory échec : ${(err as Error).message}`);
  });
  // Fire-and-forget : on ne await pas la persistance pour ne pas ralentir la réponse.
  void memoryWrites;

  return {
    conversationId: conversation.id,
    assistantMessage: assistantText || "(pas de réponse)",
    toolUses,
    costCents,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
  };
}
