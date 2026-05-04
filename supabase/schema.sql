-- ============================================================
-- Agent Platform — Schéma de base
-- À copier-coller dans Supabase → SQL Editor → Run
-- ============================================================

-- Table des clients de l'agence (= les boîtes qui paient le service)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  contact_phone text,
  industry text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients (name);
create index if not exists clients_created_at_idx on public.clients (created_at desc);

-- Table d'attribution des modules par client (pivot)
create table if not exists public.client_modules (
  client_id uuid not null references public.clients(id) on delete cascade,
  module_id text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  enabled_at timestamptz not null default now(),
  primary key (client_id, module_id)
);

create index if not exists client_modules_module_id_idx on public.client_modules (module_id);

-- Table des exécutions de modules (logs)
create table if not exists public.module_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  module_id text not null,
  status text not null check (status in ('pending', 'running', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  input jsonb,
  output jsonb,
  error_message text
);

create index if not exists module_runs_client_module_idx on public.module_runs (client_id, module_id, started_at desc);

-- ============================================================
-- Row Level Security
-- Phase 1 : tout est ouvert à tout utilisateur authentifié (l'admin Samuel).
-- Plus tard on durcira pour les comptes clients (chacun voit que son scope).
-- ============================================================

alter table public.clients enable row level security;
alter table public.client_modules enable row level security;
alter table public.module_runs enable row level security;

drop policy if exists "auth_all_clients" on public.clients;
create policy "auth_all_clients" on public.clients
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth_all_client_modules" on public.client_modules;
create policy "auth_all_client_modules" on public.client_modules
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth_all_module_runs" on public.module_runs;
create policy "auth_all_module_runs" on public.module_runs
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Seed de démarrage
-- ============================================================

insert into public.clients (id, name, contact_email, contact_phone, industry, notes) values
  ('11111111-1111-1111-1111-111111111111', 'Solaris Énergie', 'contact@solaris-energie.fr', '+33 1 23 45 67 89', 'Régie panneaux solaires', 'Régie de 12 commerciaux terrain — pilote.'),
  ('22222222-2222-2222-2222-222222222222', 'Hélios Habitat', 'direction@helios-habitat.fr', null, 'Régie panneaux solaires', 'Intéressés par optimisation tournées.')
on conflict (id) do nothing;

insert into public.client_modules (client_id, module_id, enabled, config) values
  ('11111111-1111-1111-1111-111111111111', 'lead-cleaning', true, '{"crmTarget":"icall26","removeDuplicates":true,"normalizePhones":true,"defaultCountryCode":"+33","emailFromList":[]}'::jsonb)
on conflict (client_id, module_id) do nothing;
