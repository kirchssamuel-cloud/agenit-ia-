import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ConversationChannel = "web" | "whatsapp" | "email" | "api";
export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Conversation {
  id: string;
  clientId: string;
  channel: ConversationChannel;
  title: string | null;
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string | null;
  toolCalls: unknown | null;
  toolResults: unknown | null;
  costCents: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
}

export interface ClientFact {
  id: string;
  clientId: string;
  category: string;
  fact: string;
  confidence: number;
  sourceMessageId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConvRow {
  id: string;
  client_id: string;
  channel: ConversationChannel;
  title: string | null;
  last_message_at: string;
  created_at: string;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string | null;
  tool_calls: unknown | null;
  tool_results: unknown | null;
  cost_cents: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

interface FactRow {
  id: string;
  client_id: string;
  category: string;
  fact: string;
  confidence: number;
  source_message_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToConv(r: ConvRow): Conversation {
  return {
    id: r.id,
    clientId: r.client_id,
    channel: r.channel,
    title: r.title,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
  };
}

function rowToMsg(r: MsgRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    toolCalls: r.tool_calls,
    toolResults: r.tool_results,
    costCents: r.cost_cents,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    createdAt: r.created_at,
  };
}

function rowToFact(r: FactRow): ClientFact {
  return {
    id: r.id,
    clientId: r.client_id,
    category: r.category,
    fact: r.fact,
    confidence: r.confidence,
    sourceMessageId: r.source_message_id,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ============================================================
// Conversations
// ============================================================

export async function listConversations(
  clientId: string,
  limit = 50,
): Promise<Conversation[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_conversations")
    .select("*")
    .eq("client_id", clientId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listConversations: ${error.message}`);
  return (data ?? []).map((r) => rowToConv(r as ConvRow));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getConversation: ${error.message}`);
  return data ? rowToConv(data as ConvRow) : null;
}

export async function createConversation(
  clientId: string,
  channel: ConversationChannel = "web",
  title?: string,
): Promise<Conversation> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_conversations")
    .insert({ client_id: clientId, channel, title: title ?? null })
    .select()
    .single();
  if (error || !data) throw new Error(`createConversation: ${error?.message}`);
  return rowToConv(data as ConvRow);
}

export async function touchConversation(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  await sb
    .from("agent_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", id);
}

// ============================================================
// Messages
// ============================================================

export async function listMessages(
  conversationId: string,
  limit = 100,
): Promise<Message[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listMessages: ${error.message}`);
  return (data ?? []).map((r) => rowToMsg(r as MsgRow));
}

export async function appendMessage(input: {
  conversationId: string;
  role: MessageRole;
  content?: string;
  toolCalls?: unknown;
  toolResults?: unknown;
  costCents?: number;
  tokensIn?: number;
  tokensOut?: number;
}): Promise<Message> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_messages")
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content ?? null,
      tool_calls: input.toolCalls ?? null,
      tool_results: input.toolResults ?? null,
      cost_cents: input.costCents ?? null,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`appendMessage: ${error?.message}`);
  await touchConversation(input.conversationId);
  return rowToMsg(data as MsgRow);
}

// ============================================================
// Client facts (mémoire long-terme)
// ============================================================

export async function listClientFacts(
  clientId: string,
  category?: string,
): Promise<ClientFact[]> {
  const sb = createSupabaseAdminClient();
  let query = sb
    .from("client_facts")
    .select("*")
    .eq("client_id", clientId)
    .eq("active", true);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(`listClientFacts: ${error.message}`);
  return (data ?? []).map((r) => rowToFact(r as FactRow));
}

export async function addClientFact(input: {
  clientId: string;
  category: string;
  fact: string;
  confidence?: number;
  sourceMessageId?: string;
}): Promise<ClientFact> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("client_facts")
    .insert({
      client_id: input.clientId,
      category: input.category,
      fact: input.fact,
      confidence: input.confidence ?? 1.0,
      source_message_id: input.sourceMessageId ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`addClientFact: ${error?.message}`);
  return rowToFact(data as FactRow);
}

export async function deactivateClientFact(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("client_facts")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(`deactivateClientFact: ${error.message}`);
}
