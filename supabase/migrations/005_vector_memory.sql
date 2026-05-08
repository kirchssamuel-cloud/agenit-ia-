-- Migration 005 — Mémoire vectorielle (RAG) + contexte client
-- Permet à l'agent de retrouver des souvenirs pertinents par recherche sémantique
-- au lieu de tout injecter dans le system prompt.

-- 1. Activer l'extension pgvector (Supabase Vector)
create extension if not exists vector;

-- ============================================================
-- Table client_memory : chaque morceau de mémoire (conversation, learning,
-- préférence, donnée brute) avec son embedding vectoriel.
-- ============================================================
create table if not exists public.client_memory (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('conversation', 'learning', 'preference', 'data', 'fact')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  -- text-embedding-3-small => 1536 dimensions
  embedding vector(1536),
  importance numeric not null default 0.5,  -- 0 à 1, pour pondérer la pertinence
  created_at timestamptz not null default now()
);

create index if not exists client_memory_client_idx
  on public.client_memory (client_id, type, created_at desc);

-- Index HNSW pour recherche sémantique rapide (cosine similarity)
create index if not exists client_memory_embedding_idx
  on public.client_memory using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- Table client_context : profil enrichi du client (secteur, ton, prefs)
-- 1 ligne par client (upsert).
-- ============================================================
create table if not exists public.client_context (
  client_id uuid primary key references public.clients(id) on delete cascade,
  sector text,                                -- 'construction', 'compta', 'marketing', 'panneaux solaires', etc.
  tone text default 'professionnel',          -- 'formal', 'casual', 'technical', 'professionnel'
  preferences jsonb not null default '{}'::jsonb,
  crm_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RPC match_memories : recherche sémantique top-K
-- Appelé depuis l'app via supabase.rpc('match_memories', {...}).
-- ============================================================
create or replace function public.match_memories(
  p_client_id uuid,
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_type text default null
)
returns table (
  id uuid,
  client_id uuid,
  type text,
  content text,
  metadata jsonb,
  importance numeric,
  similarity float,
  created_at timestamptz
)
language sql stable
as $$
  select
    m.id,
    m.client_id,
    m.type,
    m.content,
    m.metadata,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  from public.client_memory m
  where m.client_id = p_client_id
    and m.embedding is not null
    and (filter_type is null or m.type = filter_type)
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Table supervisor_decisions : log des validations du superviseur
-- (Phase 2 — dual-agent)
-- ============================================================
create table if not exists public.supervisor_decisions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  conversation_id uuid references public.agent_conversations(id) on delete set null,
  tool_name text not null,
  proposed_input jsonb not null,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  confidence numeric,                          -- 0 à 1, confiance du superviseur
  cost_cents integer,                          -- coût de la validation (Claude API)
  created_at timestamptz not null default now()
);
create index if not exists supervisor_decisions_client_idx
  on public.supervisor_decisions (client_id, created_at desc);
create index if not exists supervisor_decisions_tool_idx
  on public.supervisor_decisions (tool_name, decision);

-- ============================================================
-- RLS
-- ============================================================
alter table public.client_memory enable row level security;
alter table public.client_context enable row level security;
alter table public.supervisor_decisions enable row level security;

drop policy if exists "auth_all_client_memory" on public.client_memory;
create policy "auth_all_client_memory" on public.client_memory
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_client_context" on public.client_context;
create policy "auth_all_client_context" on public.client_context
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_supervisor_decisions" on public.supervisor_decisions;
create policy "auth_all_supervisor_decisions" on public.supervisor_decisions
  for all to authenticated using (true) with check (true);

-- Trigger updated_at sur client_context
drop trigger if exists trg_touch_client_context on public.client_context;
create trigger trg_touch_client_context
  before update on public.client_context
  for each row execute function public.touch_updated_at();
