-- Migration 008 — Workflow engine
-- Permet à l'agent d'orchestrer des suites d'actions multi-tours (devis,
-- relance, facturation...) avec persistance d'état entre messages.
--
-- Une "instance" = une exécution concrète d'un workflow pour un client
-- (ex: "devis-btp pour Mme Dupond"). On stocke l'état JSONB pour
-- maximum de flexibilité (chaque template peut stocker ce qu'il veut).

create table if not exists public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  /** Nom du template de workflow (ex: 'devis-btp', 'relance-client') */
  workflow_name text not null,
  /** Étape courante dans le workflow (id du step ou nom de branche) */
  current_step text not null,
  /** État JSONB : variables extraites, résultats intermédiaires, etc. */
  state jsonb not null default '{}'::jsonb,
  /** Statut courant. running = en attente d'event ; en suspens. */
  status text not null default 'running'
    check (status in ('running', 'waiting_input', 'completed', 'failed', 'cancelled')),
  /** Optionnel : conversation_id agent_brain liée (pour suivre les
      messages WhatsApp envoyés/reçus dans le cadre de ce workflow) */
  conversation_id uuid references public.agent_conversations(id) on delete set null,
  /** Description du blocage si waiting_input (ex: "Attente validation owner") */
  waiting_for text,
  /** Date d'expiration du wait_input (fail si dépassé sans réponse) */
  waiting_until timestamptz,
  /** Erreur si status=failed */
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists workflow_instances_client_idx
  on public.workflow_instances (client_id, status);
create index if not exists workflow_instances_active_idx
  on public.workflow_instances (status, updated_at desc)
  where status in ('running', 'waiting_input');

-- RLS : service_role bypass, authenticated full access (admin)
alter table public.workflow_instances enable row level security;

drop policy if exists "auth_all_workflow_instances" on public.workflow_instances;
create policy "auth_all_workflow_instances" on public.workflow_instances
  for all to authenticated using (true) with check (true);

-- Trigger pour updated_at automatique
create or replace function public.set_workflow_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workflow_instances_updated_at on public.workflow_instances;
create trigger workflow_instances_updated_at
  before update on public.workflow_instances
  for each row execute function public.set_workflow_updated_at();
