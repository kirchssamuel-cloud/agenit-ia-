import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embed } from "@/lib/embeddings";

// ============================================================
// Types
// ============================================================

export type MemoryType =
  | "conversation"
  | "learning"
  | "preference"
  | "data"
  | "fact";

export interface MemoryEntry {
  id: string;
  clientId: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  createdAt: string;
  /** Score de similarité 0..1 retourné par la recherche sémantique */
  similarity?: number;
}

export interface ClientContext {
  clientId: string;
  sector: string | null;
  tone: string;
  preferences: Record<string, unknown>;
  crmData: Record<string, unknown>;
  updatedAt: string;
}

interface MemoryRow {
  id: string;
  client_id: string;
  type: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  created_at: string;
  similarity?: number;
}

interface ContextRow {
  client_id: string;
  sector: string | null;
  tone: string | null;
  preferences: Record<string, unknown>;
  crm_data: Record<string, unknown>;
  updated_at: string;
}

function rowToMemory(r: MemoryRow): MemoryEntry {
  return {
    id: r.id,
    clientId: r.client_id,
    type: r.type,
    content: r.content,
    metadata: r.metadata ?? {},
    importance: r.importance ?? 0.5,
    createdAt: r.created_at,
    similarity: r.similarity,
  };
}

function rowToContext(r: ContextRow): ClientContext {
  return {
    clientId: r.client_id,
    sector: r.sector,
    tone: r.tone ?? "professionnel",
    preferences: r.preferences ?? {},
    crmData: r.crm_data ?? {},
    updatedAt: r.updated_at,
  };
}

// ============================================================
// Mode démo : si Supabase placeholder, on stocke en mémoire (volatile).
// Permet à la démo Vercel de fonctionner sans DB configurée.
// ============================================================

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

declare global {
  // eslint-disable-next-line no-var
  var __agentMemoryDemo:
    | { memories: MemoryEntry[]; contexts: Map<string, ClientContext> }
    | undefined;
}

function getDemoStore() {
  if (!globalThis.__agentMemoryDemo) {
    globalThis.__agentMemoryDemo = {
      memories: [],
      contexts: new Map(),
    };
  }
  return globalThis.__agentMemoryDemo;
}

// Cosine similarity for in-memory fallback when no DB.
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ============================================================
// API publique
// ============================================================

/**
 * Stocke un souvenir pour un client. Embedding calculé automatiquement
 * si OPENAI_API_KEY est configurée, sinon stocké sans embedding (recherche
 * sémantique impossible mais le souvenir est conservé en texte brut).
 */
export async function storeMemory(input: {
  clientId: string;
  content: string;
  type: MemoryType;
  metadata?: Record<string, unknown>;
  importance?: number;
}): Promise<MemoryEntry> {
  const embedding = await embed(input.content);

  // Mode démo : stockage volatile en mémoire avec embedding pour search en RAM.
  if (isSupabasePlaceholder()) {
    const entry: MemoryEntry = {
      id: `mem-${Math.random().toString(36).slice(2, 12)}`,
      clientId: input.clientId,
      type: input.type,
      content: input.content,
      metadata: { ...(input.metadata ?? {}), _embedding: embedding },
      importance: input.importance ?? 0.5,
      createdAt: new Date().toISOString(),
    };
    getDemoStore().memories.push(entry);
    return entry;
  }

  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("client_memory")
    .insert({
      client_id: input.clientId,
      type: input.type,
      content: input.content,
      metadata: input.metadata ?? {},
      importance: input.importance ?? 0.5,
      embedding: embedding ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`storeMemory: ${error?.message}`);
  return rowToMemory(data as MemoryRow);
}

/**
 * Recherche sémantique : retourne les top-K souvenirs les plus pertinents
 * pour la query. Si pas d'embeddings (pas de clé OpenAI), fallback sur les
 * derniers souvenirs créés.
 *
 * Alias : `retrieveContext` (cf. plus bas) — même chose avec une signature
 * positionnelle plus courte (clientId, query, limit) pour matcher la spec
 * du brief produit.
 */
export async function retrieveMemories(input: {
  clientId: string;
  query: string;
  limit?: number;
  matchThreshold?: number;
  filterType?: MemoryType;
}): Promise<MemoryEntry[]> {
  const limit = input.limit ?? 10;
  const threshold = input.matchThreshold ?? 0.7;

  const queryEmbedding = await embed(input.query);

  // Mode démo : cosine similarity en RAM.
  if (isSupabasePlaceholder()) {
    const store = getDemoStore();
    let memories = store.memories.filter((m) => m.clientId === input.clientId);
    if (input.filterType) {
      memories = memories.filter((m) => m.type === input.filterType);
    }
    if (queryEmbedding) {
      const scored = memories
        .map((m) => {
          const emb = (m.metadata?._embedding as number[] | undefined) ?? null;
          if (!emb) return null;
          const sim = cosine(emb, queryEmbedding);
          return { m, sim };
        })
        .filter((x): x is { m: MemoryEntry; sim: number } => x !== null && x.sim > threshold)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, limit);
      return scored.map(({ m, sim }) => ({ ...m, similarity: sim }));
    }
    // Pas d'embeddings → derniers en date
    return memories
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  // Mode prod : si pas d'embedding (pas de clé OpenAI), fallback sur les plus récents.
  if (!queryEmbedding) {
    const sb = createSupabaseAdminClient();
    let q = sb
      .from("client_memory")
      .select("*")
      .eq("client_id", input.clientId);
    if (input.filterType) q = q.eq("type", input.filterType);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`retrieveMemories fallback: ${error.message}`);
    return (data ?? []).map((r) => rowToMemory(r as MemoryRow));
  }

  // Mode prod avec embedding → RPC pgvector.
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb.rpc("match_memories", {
    p_client_id: input.clientId,
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_type: input.filterType ?? null,
  });
  if (error) throw new Error(`match_memories: ${error.message}`);
  return ((data ?? []) as MemoryRow[]).map(rowToMemory);
}

/**
 * Alias positionnel de `retrieveMemories` qui matche la spec du brief
 * produit : `retrieveContext(clientId, query, limit)`.
 *
 * Permet d'écrire du code agent simple :
 *   const context = await retrieveContext(clientId, message, 10);
 *
 * Sous le capot c'est la même fonction RAG (cosine pgvector ou RAM en démo).
 */
export async function retrieveContext(
  clientId: string,
  query: string,
  limit = 10,
  matchThreshold = 0.7,
): Promise<MemoryEntry[]> {
  return retrieveMemories({ clientId, query, limit, matchThreshold });
}

/**
 * Récupère les N derniers souvenirs (sans recherche). Utile pour le système
 * prompt pour donner le contexte récent même sans query précise.
 */
export async function listRecentMemories(
  clientId: string,
  limit = 20,
): Promise<MemoryEntry[]> {
  if (isSupabasePlaceholder()) {
    return getDemoStore()
      .memories.filter((m) => m.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("client_memory")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentMemories: ${error.message}`);
  return (data ?? []).map((r) => rowToMemory(r as MemoryRow));
}

// ============================================================
// Client context (profil enrichi)
// ============================================================

export async function getClientContext(
  clientId: string,
): Promise<ClientContext | null> {
  if (isSupabasePlaceholder()) {
    return getDemoStore().contexts.get(clientId) ?? null;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("client_context")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`getClientContext: ${error.message}`);
  return data ? rowToContext(data as ContextRow) : null;
}

export async function upsertClientContext(input: {
  clientId: string;
  sector?: string | null;
  tone?: string;
  preferences?: Record<string, unknown>;
  crmData?: Record<string, unknown>;
}): Promise<ClientContext> {
  if (isSupabasePlaceholder()) {
    const store = getDemoStore();
    const existing = store.contexts.get(input.clientId);
    const next: ClientContext = {
      clientId: input.clientId,
      sector: input.sector ?? existing?.sector ?? null,
      tone: input.tone ?? existing?.tone ?? "professionnel",
      preferences: { ...(existing?.preferences ?? {}), ...(input.preferences ?? {}) },
      crmData: { ...(existing?.crmData ?? {}), ...(input.crmData ?? {}) },
      updatedAt: new Date().toISOString(),
    };
    store.contexts.set(input.clientId, next);
    return next;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("client_context")
    .upsert({
      client_id: input.clientId,
      sector: input.sector ?? null,
      tone: input.tone ?? "professionnel",
      preferences: input.preferences ?? {},
      crm_data: input.crmData ?? {},
    })
    .select()
    .single();
  if (error || !data) throw new Error(`upsertClientContext: ${error?.message}`);
  return rowToContext(data as ContextRow);
}
