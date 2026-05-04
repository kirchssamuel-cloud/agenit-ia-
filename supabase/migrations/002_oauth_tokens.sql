-- Migration 002 — Stockage des tokens OAuth des clients
-- À runner dans Supabase → SQL Editor après schema.sql initial.

create table if not exists public.client_oauth_tokens (
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token text not null,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  account_email text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (client_id, provider)
);

create index if not exists client_oauth_tokens_provider_idx on public.client_oauth_tokens (provider);

alter table public.client_oauth_tokens enable row level security;

drop policy if exists "auth_all_oauth_tokens" on public.client_oauth_tokens;
create policy "auth_all_oauth_tokens" on public.client_oauth_tokens
  for all
  to authenticated
  using (true)
  with check (true);

-- Trigger : updated_at auto
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_oauth_tokens on public.client_oauth_tokens;
create trigger trg_touch_oauth_tokens
  before update on public.client_oauth_tokens
  for each row execute function public.touch_updated_at();
