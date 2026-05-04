-- Migration 004 — Le cerveau de l'agent
-- Conversations, messages, mémoire long-terme par client.

-- Une conversation = un fil de discussion entre un client et son agent.
create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null default 'web' check (channel in ('web', 'whatsapp', 'email', 'api')),
  title text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists agent_conversations_client_idx
  on public.agent_conversations (client_id, last_message_at desc);

-- Chaque message dans une conversation.
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text,
  tool_calls jsonb,                                  -- si l'agent a appelé des tools
  tool_results jsonb,                                -- résultat de l'exécution des tools
  cost_cents integer,                                -- coût Claude en cents (pour reporting)
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_conv_idx
  on public.agent_messages (conversation_id, created_at);

-- Mémoire long-terme par client : faits qui doivent persister entre conversations.
-- Ex: "Le commercial Marc préfère les RDV le matin", "La marge habituelle est de 30%"
create table if not exists public.client_facts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null,                            -- ex: 'preference', 'pricing', 'team', 'process'
  fact text not null,                                -- le fait en langage naturel
  confidence numeric not null default 1.0,           -- 0 à 1, à quel point c'est sûr
  source_message_id uuid references public.agent_messages(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_facts_client_idx
  on public.client_facts (client_id, category) where active = true;

-- RLS
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.client_facts enable row level security;

drop policy if exists "auth_all_agent_conversations" on public.agent_conversations;
create policy "auth_all_agent_conversations" on public.agent_conversations
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_agent_messages" on public.agent_messages;
create policy "auth_all_agent_messages" on public.agent_messages
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_client_facts" on public.client_facts;
create policy "auth_all_client_facts" on public.client_facts
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_touch_client_facts on public.client_facts;
create trigger trg_touch_client_facts
  before update on public.client_facts
  for each row execute function public.touch_updated_at();
