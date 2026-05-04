-- Migration 003 — Système d'intelligence évolutive
-- Compétences que l'admin enseigne à l'agent + historique des apprentissages.

create table if not exists public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_pattern text,                              -- ex : "le client demande un devis"
  action_template text,                              -- ex : "génère un devis avec ces données : {...}"
  examples jsonb not null default '[]'::jsonb,       -- liste de conversations exemples
  module_id text,                                    -- optionnel : lié à un module
  client_scope text not null default 'all',          -- 'all' ou client_id
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  success_count integer not null default 0,
  uses_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_skills_status_idx on public.agent_skills (status);
create index if not exists agent_skills_module_id_idx on public.agent_skills (module_id);

create table if not exists public.agent_learnings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('correction', 'new_skill', 'improvement', 'auto_fix')),
  skill_id uuid references public.agent_skills(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  approved_by_admin boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_learnings_skill_id_idx on public.agent_learnings (skill_id);
create index if not exists agent_learnings_approved_idx on public.agent_learnings (approved_by_admin);

-- Settings par module (override prix, statut, limites)
create table if not exists public.module_settings (
  module_id text primary key,
  price_monthly_eur integer,                          -- NULL = pas d'override (utilise le défaut du code)
  is_published boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.agent_skills enable row level security;
alter table public.agent_learnings enable row level security;
alter table public.module_settings enable row level security;

drop policy if exists "auth_all_agent_skills" on public.agent_skills;
create policy "auth_all_agent_skills" on public.agent_skills
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_agent_learnings" on public.agent_learnings;
create policy "auth_all_agent_learnings" on public.agent_learnings
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_module_settings" on public.module_settings;
create policy "auth_all_module_settings" on public.module_settings
  for all to authenticated using (true) with check (true);

-- Triggers updated_at
drop trigger if exists trg_touch_agent_skills on public.agent_skills;
create trigger trg_touch_agent_skills
  before update on public.agent_skills
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_module_settings on public.module_settings;
create trigger trg_touch_module_settings
  before update on public.module_settings
  for each row execute function public.touch_updated_at();
