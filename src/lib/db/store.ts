import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { tryNormalizePhoneE164 } from "@/lib/utils/phone";
import type { Client, ClientModule } from "./types";

// ============================================================
// Mappers DB ↔ App
// ============================================================

interface ClientRow {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
}

interface ClientModuleRow {
  client_id: string;
  module_id: string;
  enabled: boolean;
  config: Record<string, unknown>;
  enabled_at: string;
}

function rowToClient(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone ?? undefined,
    industry: r.industry ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToClientModule(r: ClientModuleRow): ClientModule {
  return {
    clientId: r.client_id,
    moduleId: r.module_id,
    enabled: r.enabled,
    config: r.config,
    enabledAt: r.enabled_at,
  };
}

// ============================================================
// Cache mémoire pour le rendu sync (Server Components)
// On hydrate au boot puis revalide à chaque écriture.
// ============================================================

declare global {
  // eslint-disable-next-line no-var
  var __agentCache:
    | {
        clients: Client[];
        clientModules: ClientModule[];
        loaded: boolean;
        loadingPromise: Promise<void> | null;
      }
    | undefined;
}

function getCache() {
  if (!globalThis.__agentCache) {
    globalThis.__agentCache = {
      clients: [],
      clientModules: [],
      loaded: false,
      loadingPromise: null,
    };
  }
  return globalThis.__agentCache;
}

async function refreshCache(): Promise<void> {
  const sb = createSupabaseAdminClient();
  const [{ data: clients, error: e1 }, { data: cms, error: e2 }] = await Promise.all([
    sb.from("clients").select("*").order("name", { ascending: true }),
    sb.from("client_modules").select("*"),
  ]);
  if (e1) throw new Error(`clients fetch: ${e1.message}`);
  if (e2) throw new Error(`client_modules fetch: ${e2.message}`);
  const cache = getCache();
  cache.clients = (clients ?? []).map(rowToClient);
  cache.clientModules = (cms ?? []).map(rowToClientModule);
  cache.loaded = true;
}

/** True si les clés Supabase sont des placeholders (mode démo local). */
function isSupabasePlaceholder(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return (
    url.includes("placeholder") ||
    key.includes("placeholder") ||
    url === "" ||
    key === ""
  );
}

export async function ensureLoaded(): Promise<void> {
  const cache = getCache();
  if (cache.loaded) return;

  // Mode démo : Supabase pas encore configuré → on hydrate avec un cache vide
  // pour permettre à l'UI admin de s'afficher sans erreur.
  if (isSupabasePlaceholder()) {
    cache.clients = [];
    cache.clientModules = [];
    cache.loaded = true;
    return;
  }

  if (!cache.loadingPromise) {
    cache.loadingPromise = refreshCache().finally(() => {
      cache.loadingPromise = null;
    });
  }
  await cache.loadingPromise;
}

// ============================================================
// API publique (sync depuis le cache, async pour les écritures)
// ============================================================

export function listClients(): Client[] {
  return [...getCache().clients].sort((a, b) => a.name.localeCompare(b.name));
}

export function getClient(id: string): Client | undefined {
  return getCache().clients.find((c) => c.id === id);
}

/**
 * Lookup d'un client par téléphone (E.164 normalisé attendu).
 *
 * Utilisé par le webhook WhatsApp pour identifier le user à partir
 * de `From` quand le numéro Twilio destinataire est partagé (sandbox).
 *
 * Robuste aux clients legacy : si le `contactPhone` stocké en DB n'est
 * pas normalisé (signup avant ce fix), on tente une normalisation à
 * la volée pour matcher quand même.
 *
 * Retourne `undefined` si aucun client n'a ce contactPhone. Si plusieurs
 * clients partagent le même numéro (cas anormal), retourne le 1er.
 */
export function getClientByPhone(phone: string): Client | undefined {
  if (!phone) return undefined;
  const target = tryNormalizePhoneE164(phone) ?? phone;
  return getCache().clients.find((c) => {
    if (!c.contactPhone) return false;
    if (c.contactPhone === target) return true;
    const normalized = tryNormalizePhoneE164(c.contactPhone);
    return normalized === target;
  });
}

export function listClientModules(clientId: string): ClientModule[] {
  return getCache().clientModules.filter((cm) => cm.clientId === clientId);
}

export function countClientsForModule(moduleId: string): number {
  return getCache().clientModules.filter((cm) => cm.moduleId === moduleId && cm.enabled).length;
}

export async function createClient(
  input: Omit<Client, "id" | "createdAt">,
): Promise<Client> {
  // Mode démo : on crée un client en mémoire si Supabase pas branché.
  if (isSupabasePlaceholder()) {
    const cache = getCache();
    const newClient: Client = {
      id: `demo-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      ...input,
    };
    cache.clients = [...cache.clients, newClient];
    cache.loaded = true;
    return newClient;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("clients")
    .insert({
      name: input.name,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone ?? null,
      industry: input.industry ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`create client: ${error?.message}`);
  await refreshCache();
  return rowToClient(data as ClientRow);
}

export async function updateClient(
  id: string,
  patch: Partial<Omit<Client, "id" | "createdAt">>,
): Promise<Client | undefined> {
  const sb = createSupabaseAdminClient();
  const update: Partial<ClientRow> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.contactEmail !== undefined) update.contact_email = patch.contactEmail;
  if (patch.contactPhone !== undefined) update.contact_phone = patch.contactPhone ?? null;
  if (patch.industry !== undefined) update.industry = patch.industry ?? null;
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  const { data, error } = await sb
    .from("clients")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`update client: ${error.message}`);
  await refreshCache();
  return data ? rowToClient(data as ClientRow) : undefined;
}

export async function deleteClient(id: string): Promise<boolean> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) throw new Error(`delete client: ${error.message}`);
  await refreshCache();
  return true;
}

export async function setClientModuleEnabled(
  clientId: string,
  moduleId: string,
  enabled: boolean,
  defaultConfig: Record<string, unknown> = {},
): Promise<ClientModule> {
  // Mode démo : upsert en mémoire si Supabase pas branché.
  if (isSupabasePlaceholder()) {
    const cache = getCache();
    const existing = cache.clientModules.find(
      (cm) => cm.clientId === clientId && cm.moduleId === moduleId,
    );
    if (existing) {
      existing.enabled = enabled;
      return existing;
    }
    const created: ClientModule = {
      clientId,
      moduleId,
      enabled,
      config: defaultConfig,
      enabledAt: new Date().toISOString(),
    };
    cache.clientModules = [...cache.clientModules, created];
    return created;
  }

  const sb = createSupabaseAdminClient();

  // Upsert
  const { data: existing } = await sb
    .from("client_modules")
    .select("*")
    .eq("client_id", clientId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from("client_modules")
      .update({ enabled })
      .eq("client_id", clientId)
      .eq("module_id", moduleId)
      .select()
      .single();
    if (error || !data) throw new Error(`update client_module: ${error?.message}`);
    await refreshCache();
    return rowToClientModule(data as ClientModuleRow);
  }

  const { data, error } = await sb
    .from("client_modules")
    .insert({
      client_id: clientId,
      module_id: moduleId,
      enabled,
      config: defaultConfig,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insert client_module: ${error?.message}`);
  await refreshCache();
  return rowToClientModule(data as ClientModuleRow);
}
