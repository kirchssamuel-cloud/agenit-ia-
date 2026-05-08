-- Migration 007 — WhatsApp multi-agents
-- Pool de numéros WhatsApp (achetés via Twilio) attribués automatiquement
-- aux clients qui paient. Chaque message entrant/sortant est tracé.
--
-- IMPORTANT : "client_id" référence public.clients(id) (pas users) car notre
-- modèle de données est "agence d'agents" : 1 client = 1 boîte abonnée à
-- la plateforme = 1 numéro WhatsApp dédié à son agent IA.

-- ============================================================
-- Pool de numéros WhatsApp
-- Statuts :
--   available : libre, prêt à attribuer au prochain nouveau client payant
--   assigned  : attribué à un client (1 numéro = 1 client max)
--   suspended : retiré du pool (problème Twilio, fraude, suspension paiement)
-- ============================================================
create table if not exists public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,                -- format E.164 : +33712345678
  twilio_sid text unique,                           -- Twilio PNxxx ou null si pas Twilio
  twilio_messaging_service_sid text,                -- optionnel : si on utilise Messaging Service
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'available'
    check (status in ('available', 'assigned', 'suspended')),
  monthly_cost_cents integer,                       -- coût récurrent (~1$/mois Twilio)
  country_code text default 'FR',
  notes text,
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_numbers_client_idx
  on public.whatsapp_numbers (client_id);
create index if not exists whatsapp_numbers_status_idx
  on public.whatsapp_numbers (status);

-- ============================================================
-- Historique des messages WhatsApp
-- Garde tout : entrant et sortant, pour audit + replay + fine-tuning.
-- ============================================================
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  whatsapp_number_id uuid references public.whatsapp_numbers(id) on delete set null,
  /** numéro de l'utilisateur qui parle à l'agent (le téléphone perso du client) */
  user_phone text not null,
  /** numéro de l'agent (= numéro Twilio attribué au client) */
  agent_phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_text text not null,
  /** Type de média (text par défaut, mais Twilio peut envoyer image/audio/video) */
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'audio', 'video', 'document', 'location')),
  media_url text,
  twilio_sid text,                                  -- MMxxx ou SMxxx
  status text not null default 'received'
    check (status in ('received', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_message text,
  /** Réponse de l'agent qui a généré ce message (lien vers conversation) */
  agent_conversation_id uuid references public.agent_conversations(id) on delete set null,
  cost_cents integer,                               -- coût Twilio (~0.5¢ par msg)
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_client_idx
  on public.whatsapp_messages (client_id, created_at desc);
create index if not exists whatsapp_messages_user_phone_idx
  on public.whatsapp_messages (user_phone, created_at desc);
create index if not exists whatsapp_messages_status_idx
  on public.whatsapp_messages (status) where status in ('queued', 'sending', 'failed');

-- ============================================================
-- RLS
-- ============================================================
alter table public.whatsapp_numbers enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists "auth_all_whatsapp_numbers" on public.whatsapp_numbers;
create policy "auth_all_whatsapp_numbers" on public.whatsapp_numbers
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_whatsapp_messages" on public.whatsapp_messages;
create policy "auth_all_whatsapp_messages" on public.whatsapp_messages
  for all to authenticated using (true) with check (true);

-- ============================================================
-- Helpers RPC
-- ============================================================

-- Attribue un numéro libre au premier client demandé. Atomique pour éviter
-- les race conditions (2 clients qui paient en même temps).
create or replace function public.assign_whatsapp_number(p_client_id uuid)
returns public.whatsapp_numbers
language plpgsql
as $$
declare
  picked public.whatsapp_numbers;
begin
  -- Si le client a déjà un numéro, on le retourne tel quel.
  select * into picked
    from public.whatsapp_numbers
    where client_id = p_client_id
      and status = 'assigned'
    limit 1;
  if found then
    return picked;
  end if;

  -- Sinon on prend le premier dispo et on le verrouille.
  update public.whatsapp_numbers
    set client_id = p_client_id,
        status = 'assigned',
        assigned_at = now()
    where id = (
      select id from public.whatsapp_numbers
        where status = 'available'
        order by created_at asc
        for update skip locked
        limit 1
    )
    returning * into picked;

  if not found then
    raise exception 'NO_WHATSAPP_NUMBER_AVAILABLE';
  end if;
  return picked;
end;
$$;
