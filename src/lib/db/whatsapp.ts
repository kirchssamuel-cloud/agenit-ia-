import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Types
// ============================================================

export type WhatsAppNumberStatus = "available" | "assigned" | "suspended";
export type WhatsAppDirection = "inbound" | "outbound";
export type WhatsAppMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location";
export type WhatsAppMessageStatus =
  | "received"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface WhatsAppNumber {
  id: string;
  phoneNumber: string; // E.164 format
  twilioSid: string | null;
  twilioMessagingServiceSid: string | null;
  clientId: string | null;
  status: WhatsAppNumberStatus;
  monthlyCostCents: number | null;
  countryCode: string;
  notes: string | null;
  assignedAt: string | null;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  clientId: string;
  whatsappNumberId: string | null;
  userPhone: string;
  agentPhone: string;
  direction: WhatsAppDirection;
  messageText: string;
  messageType: WhatsAppMessageType;
  mediaUrl: string | null;
  twilioSid: string | null;
  status: WhatsAppMessageStatus;
  errorCode: string | null;
  errorMessage: string | null;
  agentConversationId: string | null;
  costCents: number | null;
  createdAt: string;
}

interface NumberRow {
  id: string;
  phone_number: string;
  twilio_sid: string | null;
  twilio_messaging_service_sid: string | null;
  client_id: string | null;
  status: WhatsAppNumberStatus;
  monthly_cost_cents: number | null;
  country_code: string;
  notes: string | null;
  assigned_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  client_id: string;
  whatsapp_number_id: string | null;
  user_phone: string;
  agent_phone: string;
  direction: WhatsAppDirection;
  message_text: string;
  message_type: WhatsAppMessageType;
  media_url: string | null;
  twilio_sid: string | null;
  status: WhatsAppMessageStatus;
  error_code: string | null;
  error_message: string | null;
  agent_conversation_id: string | null;
  cost_cents: number | null;
  created_at: string;
}

function rowToNumber(r: NumberRow): WhatsAppNumber {
  return {
    id: r.id,
    phoneNumber: r.phone_number,
    twilioSid: r.twilio_sid,
    twilioMessagingServiceSid: r.twilio_messaging_service_sid,
    clientId: r.client_id,
    status: r.status,
    monthlyCostCents: r.monthly_cost_cents,
    countryCode: r.country_code,
    notes: r.notes,
    assignedAt: r.assigned_at,
    createdAt: r.created_at,
  };
}

function rowToMessage(r: MessageRow): WhatsAppMessage {
  return {
    id: r.id,
    clientId: r.client_id,
    whatsappNumberId: r.whatsapp_number_id,
    userPhone: r.user_phone,
    agentPhone: r.agent_phone,
    direction: r.direction,
    messageText: r.message_text,
    messageType: r.message_type,
    mediaUrl: r.media_url,
    twilioSid: r.twilio_sid,
    status: r.status,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    agentConversationId: r.agent_conversation_id,
    costCents: r.cost_cents,
    createdAt: r.created_at,
  };
}

// ============================================================
// Mode démo (Supabase pas configuré → store en RAM)
// ============================================================

function isDemoMode(): boolean {
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
  var __whatsappDemo:
    | { numbers: WhatsAppNumber[]; messages: WhatsAppMessage[] }
    | undefined;
}

/**
 * En démo on pré-remplit le pool avec 5 numéros fictifs pour que l'admin
 * puisse voir l'attribution se faire.
 */
function getDemoStore() {
  if (!globalThis.__whatsappDemo) {
    const now = new Date().toISOString();
    globalThis.__whatsappDemo = {
      numbers: [
        {
          id: "wa-demo-01",
          phoneNumber: "+33712345601",
          twilioSid: null,
          twilioMessagingServiceSid: null,
          clientId: null,
          status: "available",
          monthlyCostCents: 100,
          countryCode: "FR",
          notes: "Numéro démo (mode dev)",
          assignedAt: null,
          createdAt: now,
        },
        {
          id: "wa-demo-02",
          phoneNumber: "+33712345602",
          twilioSid: null,
          twilioMessagingServiceSid: null,
          clientId: null,
          status: "available",
          monthlyCostCents: 100,
          countryCode: "FR",
          notes: "Numéro démo (mode dev)",
          assignedAt: null,
          createdAt: now,
        },
        {
          id: "wa-demo-03",
          phoneNumber: "+33712345603",
          twilioSid: null,
          twilioMessagingServiceSid: null,
          clientId: null,
          status: "available",
          monthlyCostCents: 100,
          countryCode: "FR",
          notes: "Numéro démo (mode dev)",
          assignedAt: null,
          createdAt: now,
        },
        {
          id: "wa-demo-04",
          phoneNumber: "+33712345604",
          twilioSid: null,
          twilioMessagingServiceSid: null,
          clientId: null,
          status: "available",
          monthlyCostCents: 100,
          countryCode: "FR",
          notes: "Numéro démo (mode dev)",
          assignedAt: null,
          createdAt: now,
        },
        {
          id: "wa-demo-05",
          phoneNumber: "+33712345605",
          twilioSid: null,
          twilioMessagingServiceSid: null,
          clientId: null,
          status: "available",
          monthlyCostCents: 100,
          countryCode: "FR",
          notes: "Numéro démo (mode dev)",
          assignedAt: null,
          createdAt: now,
        },
      ],
      messages: [],
    };
  }
  return globalThis.__whatsappDemo;
}

// ============================================================
// API publique — Pool de numéros
// ============================================================

export async function listAllNumbers(): Promise<WhatsAppNumber[]> {
  if (isDemoMode()) {
    return [...getDemoStore().numbers].sort((a, b) =>
      a.phoneNumber.localeCompare(b.phoneNumber),
    );
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_numbers")
    .select("*")
    .order("phone_number", { ascending: true });
  if (error) throw new Error(`listAllNumbers: ${error.message}`);
  return (data ?? []).map((r) => rowToNumber(r as NumberRow));
}

export async function listAvailableNumbers(): Promise<WhatsAppNumber[]> {
  if (isDemoMode()) {
    return getDemoStore().numbers.filter((n) => n.status === "available");
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_numbers")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listAvailableNumbers: ${error.message}`);
  return (data ?? []).map((r) => rowToNumber(r as NumberRow));
}

export async function getNumberByPhone(
  phoneNumber: string,
): Promise<WhatsAppNumber | null> {
  if (isDemoMode()) {
    return (
      getDemoStore().numbers.find((n) => n.phoneNumber === phoneNumber) ?? null
    );
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_numbers")
    .select("*")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  if (error) throw new Error(`getNumberByPhone: ${error.message}`);
  return data ? rowToNumber(data as NumberRow) : null;
}

export async function getNumberForClient(
  clientId: string,
): Promise<WhatsAppNumber | null> {
  if (isDemoMode()) {
    return (
      getDemoStore().numbers.find(
        (n) => n.clientId === clientId && n.status === "assigned",
      ) ?? null
    );
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_numbers")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "assigned")
    .maybeSingle();
  if (error) throw new Error(`getNumberForClient: ${error.message}`);
  return data ? rowToNumber(data as NumberRow) : null;
}

export async function importNumber(input: {
  phoneNumber: string;
  twilioSid?: string;
  twilioMessagingServiceSid?: string;
  monthlyCostCents?: number;
  countryCode?: string;
  notes?: string;
}): Promise<WhatsAppNumber> {
  if (isDemoMode()) {
    const store = getDemoStore();
    if (store.numbers.some((n) => n.phoneNumber === input.phoneNumber)) {
      throw new Error("Numéro déjà importé");
    }
    const created: WhatsAppNumber = {
      id: `wa-demo-${Math.random().toString(36).slice(2, 10)}`,
      phoneNumber: input.phoneNumber,
      twilioSid: input.twilioSid ?? null,
      twilioMessagingServiceSid: input.twilioMessagingServiceSid ?? null,
      clientId: null,
      status: "available",
      monthlyCostCents: input.monthlyCostCents ?? 100,
      countryCode: input.countryCode ?? "FR",
      notes: input.notes ?? null,
      assignedAt: null,
      createdAt: new Date().toISOString(),
    };
    store.numbers.push(created);
    return created;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_numbers")
    .insert({
      phone_number: input.phoneNumber,
      twilio_sid: input.twilioSid ?? null,
      twilio_messaging_service_sid: input.twilioMessagingServiceSid ?? null,
      monthly_cost_cents: input.monthlyCostCents ?? 100,
      country_code: input.countryCode ?? "FR",
      notes: input.notes ?? null,
      status: "available",
    })
    .select()
    .single();
  if (error || !data) throw new Error(`importNumber: ${error?.message}`);
  return rowToNumber(data as NumberRow);
}

/**
 * Attribue (atomiquement) un numéro libre à un client. Si le client en a déjà
 * un, retourne celui-là (idempotent). Throw NO_WHATSAPP_NUMBER_AVAILABLE si
 * le pool est vide.
 */
export async function assignNumberToClient(
  clientId: string,
): Promise<WhatsAppNumber> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const existing = store.numbers.find(
      (n) => n.clientId === clientId && n.status === "assigned",
    );
    if (existing) return existing;
    const free = store.numbers.find((n) => n.status === "available");
    if (!free) throw new Error("NO_WHATSAPP_NUMBER_AVAILABLE");
    free.clientId = clientId;
    free.status = "assigned";
    free.assignedAt = new Date().toISOString();
    return free;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb.rpc("assign_whatsapp_number", {
    p_client_id: clientId,
  });
  if (error) throw new Error(`assign_whatsapp_number: ${error.message}`);
  return rowToNumber(data as NumberRow);
}

export async function releaseNumber(numberId: string): Promise<void> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const n = store.numbers.find((x) => x.id === numberId);
    if (n) {
      n.clientId = null;
      n.status = "available";
      n.assignedAt = null;
    }
    return;
  }
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("whatsapp_numbers")
    .update({
      client_id: null,
      status: "available",
      assigned_at: null,
    })
    .eq("id", numberId);
  if (error) throw new Error(`releaseNumber: ${error.message}`);
}

export async function setNumberStatus(
  numberId: string,
  status: WhatsAppNumberStatus,
): Promise<void> {
  if (isDemoMode()) {
    const n = getDemoStore().numbers.find((x) => x.id === numberId);
    if (n) n.status = status;
    return;
  }
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("whatsapp_numbers")
    .update({ status })
    .eq("id", numberId);
  if (error) throw new Error(`setNumberStatus: ${error.message}`);
}

// ============================================================
// API publique — Messages
// ============================================================

export async function appendWhatsAppMessage(input: {
  clientId: string;
  whatsappNumberId?: string;
  userPhone: string;
  agentPhone: string;
  direction: WhatsAppDirection;
  messageText: string;
  messageType?: WhatsAppMessageType;
  mediaUrl?: string;
  twilioSid?: string;
  status?: WhatsAppMessageStatus;
  errorCode?: string;
  errorMessage?: string;
  agentConversationId?: string;
  costCents?: number;
}): Promise<WhatsAppMessage> {
  if (isDemoMode()) {
    const created: WhatsAppMessage = {
      id: `wam-${Math.random().toString(36).slice(2, 12)}`,
      clientId: input.clientId,
      whatsappNumberId: input.whatsappNumberId ?? null,
      userPhone: input.userPhone,
      agentPhone: input.agentPhone,
      direction: input.direction,
      messageText: input.messageText,
      messageType: input.messageType ?? "text",
      mediaUrl: input.mediaUrl ?? null,
      twilioSid: input.twilioSid ?? null,
      status: input.status ?? (input.direction === "inbound" ? "received" : "sent"),
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      agentConversationId: input.agentConversationId ?? null,
      costCents: input.costCents ?? null,
      createdAt: new Date().toISOString(),
    };
    getDemoStore().messages.push(created);
    return created;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_messages")
    .insert({
      client_id: input.clientId,
      whatsapp_number_id: input.whatsappNumberId ?? null,
      user_phone: input.userPhone,
      agent_phone: input.agentPhone,
      direction: input.direction,
      message_text: input.messageText,
      message_type: input.messageType ?? "text",
      media_url: input.mediaUrl ?? null,
      twilio_sid: input.twilioSid ?? null,
      status:
        input.status ?? (input.direction === "inbound" ? "received" : "sent"),
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      agent_conversation_id: input.agentConversationId ?? null,
      cost_cents: input.costCents ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`appendWhatsAppMessage: ${error?.message}`);
  return rowToMessage(data as MessageRow);
}

export async function listMessagesForClient(
  clientId: string,
  limit = 100,
): Promise<WhatsAppMessage[]> {
  if (isDemoMode()) {
    return getDemoStore()
      .messages.filter((m) => m.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("whatsapp_messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listMessagesForClient: ${error.message}`);
  return (data ?? []).map((r) => rowToMessage(r as MessageRow));
}

export async function countMessagesForClient(
  clientId: string,
): Promise<{ inbound: number; outbound: number; failed: number }> {
  const all = await listMessagesForClient(clientId, 10_000);
  return {
    inbound: all.filter((m) => m.direction === "inbound").length,
    outbound: all.filter((m) => m.direction === "outbound").length,
    failed: all.filter((m) => m.status === "failed").length,
  };
}
