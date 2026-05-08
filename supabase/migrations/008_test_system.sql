-- Migration 008 — Système d'évaluation & amélioration continue de l'agent
--
-- Banque de tests par domaine + exécutions + lacunes détectées + métriques.
-- Objectif : tester l'agent automatiquement chaque nuit, mesurer la qualité,
-- détecter les domaines où il est faible, enrichir la knowledge base.

-- ============================================================
-- Table test_questions : banque de questions de référence
-- ============================================================
create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  /** Slug du domaine (ex: 'finance', 'btp', 'judaisme', 'comptabilite') */
  domain text not null,
  /** Code court stable (ex: 'finance-001') pour seed/import */
  code text unique,
  /** Difficulté pour pondérer la note */
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  question text not null,
  /** Concepts attendus dans la réponse (sémantique) */
  expected_concepts text[] not null default '{}',
  /** Mots-clés techniques attendus (vocabulaire métier) */
  expected_keywords text[] not null default '{}',
  /** Score minimum pour passer (par défaut 7.0/10) */
  min_score numeric not null default 7.0,
  /** Source : 'seed' (codé en TS) ou 'admin' (créé via UI) */
  source text not null default 'seed',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists test_questions_domain_idx
  on public.test_questions (domain) where active = true;

-- ============================================================
-- Table test_results : exécutions individuelles
-- ============================================================
create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.test_questions(id) on delete cascade,
  /** Le run global (pour grouper les résultats d'un test suite complet) */
  run_id uuid,
  /** Réponse brute de l'agent */
  agent_response text not null,
  /** Note attribuée par l'évaluateur 0-10 */
  evaluator_score numeric(3, 1),
  evaluator_feedback text,
  /** Concepts détectés comme manquants par l'évaluateur */
  missing_concepts text[] not null default '{}',
  missing_keywords text[] not null default '{}',
  passed boolean not null default false,
  execution_time_ms integer,
  /** Coût Anthropic pour ce test (run + évaluation) */
  cost_cents integer,
  tokens_in integer,
  tokens_out integer,
  /** Modèle agent utilisé (pour tracker l'amélioration version par version) */
  agent_model text,
  evaluator_model text,
  tested_at timestamptz not null default now()
);
create index if not exists test_results_question_idx
  on public.test_results (question_id, tested_at desc);
create index if not exists test_results_run_idx
  on public.test_results (run_id);
create index if not exists test_results_passed_idx
  on public.test_results (passed, tested_at desc);

-- ============================================================
-- Table agent_gaps : lacunes détectées (pour amélioration)
-- ============================================================
create table if not exists public.agent_gaps (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  gap_type text not null check (gap_type in (
    'missing_vocab',      -- mots-clés techniques absents
    'missing_concept',    -- concept clé non couvert
    'wrong_method',       -- approche/raisonnement incorrect
    'incorrect_fact',     -- fait factuel erroné
    'tone_mismatch',      -- ton inadapté au métier
    'unknown'
  )),
  description text not null,
  /** Exemple concret de question où le gap est apparu */
  example_question_id uuid references public.test_questions(id) on delete set null,
  example_test_result_id uuid references public.test_results(id) on delete set null,
  /** Nombre d'occurrences (un même gap peut revenir sur plusieurs questions) */
  occurrence_count integer not null default 1,
  status text not null default 'open' check (status in ('open', 'fixed', 'wontfix', 'in_progress')),
  /** Suggestion auto de fix générée par le knowledge-enricher */
  suggested_fix text,
  /** Marqué fixed quand l'admin valide la correction */
  fixed_by text,
  fixed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_gaps_domain_idx
  on public.agent_gaps (domain, status);
create index if not exists agent_gaps_open_idx
  on public.agent_gaps (created_at desc) where status = 'open';

-- ============================================================
-- Table domain_metrics : agrégats par domaine (mises à jour à chaque run)
-- ============================================================
create table if not exists public.domain_metrics (
  domain text primary key,
  total_tests integer not null default 0,
  passed_tests integer not null default 0,
  /** Taux de réussite en pourcentage (0-100) */
  success_rate numeric(5, 2) not null default 0,
  /** Moyenne du score sur 10 */
  avg_score numeric(3, 1) not null default 0,
  /** Nombre de gaps actuellement ouverts */
  open_gaps_count integer not null default 0,
  last_tested timestamptz,
  /** Évolution : score précédent pour détecter régression/amélioration */
  previous_avg_score numeric(3, 1),
  trend text check (trend in ('improving', 'stable', 'declining')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.test_questions enable row level security;
alter table public.test_results enable row level security;
alter table public.agent_gaps enable row level security;
alter table public.domain_metrics enable row level security;

drop policy if exists "auth_all_test_questions" on public.test_questions;
create policy "auth_all_test_questions" on public.test_questions
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_test_results" on public.test_results;
create policy "auth_all_test_results" on public.test_results
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_agent_gaps" on public.agent_gaps;
create policy "auth_all_agent_gaps" on public.agent_gaps
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_domain_metrics" on public.domain_metrics;
create policy "auth_all_domain_metrics" on public.domain_metrics
  for all to authenticated using (true) with check (true);

-- Trigger updated_at
drop trigger if exists trg_touch_test_questions on public.test_questions;
create trigger trg_touch_test_questions
  before update on public.test_questions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_agent_gaps on public.agent_gaps;
create trigger trg_touch_agent_gaps
  before update on public.agent_gaps
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_domain_metrics on public.domain_metrics;
create trigger trg_touch_domain_metrics
  before update on public.domain_metrics
  for each row execute function public.touch_updated_at();
