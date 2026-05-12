import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WorkflowInstance, WorkflowState, WorkflowStatus } from "./types";

/**
 * DAO pour workflow_instances. Supabase si configuré, sinon store mémoire
 * pour le mode démo local.
 */

interface WorkflowRow {
  id: string;
  client_id: string;
  workflow_name: string;
  current_step: string;
  state: WorkflowState;
  status: WorkflowStatus;
  conversation_id: string | null;
  waiting_for: string | null;
  waiting_until: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function rowToInstance(r: WorkflowRow): WorkflowInstance {
  return {
    id: r.id,
    clientId: r.client_id,
    workflowName: r.workflow_name,
    currentStep: r.current_step,
    state: r.state ?? {},
    status: r.status,
    conversationId: r.conversation_id ?? undefined,
    waitingFor: r.waiting_for ?? undefined,
    waitingUntil: r.waiting_until ? new Date(r.waiting_until) : undefined,
    lastError: r.last_error ?? undefined,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
  };
}

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
  var __workflowDemoStore: WorkflowInstance[] | undefined;
}

function getDemoStore(): WorkflowInstance[] {
  if (!globalThis.__workflowDemoStore) {
    globalThis.__workflowDemoStore = [];
  }
  return globalThis.__workflowDemoStore;
}

export async function createWorkflowInstance(input: {
  clientId: string;
  workflowName: string;
  startStep: string;
  initialState?: WorkflowState;
  conversationId?: string;
}): Promise<WorkflowInstance> {
  if (isDemoMode()) {
    const now = new Date();
    const instance: WorkflowInstance = {
      id: `wf-demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      clientId: input.clientId,
      workflowName: input.workflowName,
      currentStep: input.startStep,
      state: input.initialState ?? {},
      status: "running",
      conversationId: input.conversationId,
      createdAt: now,
      updatedAt: now,
    };
    getDemoStore().push(instance);
    return instance;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("workflow_instances")
    .insert({
      client_id: input.clientId,
      workflow_name: input.workflowName,
      current_step: input.startStep,
      state: input.initialState ?? {},
      status: "running",
      conversation_id: input.conversationId,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createWorkflowInstance: ${error?.message}`);
  return rowToInstance(data as WorkflowRow);
}

export async function getWorkflowInstance(id: string): Promise<WorkflowInstance | null> {
  if (isDemoMode()) {
    return getDemoStore().find((i) => i.id === id) ?? null;
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("workflow_instances")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getWorkflowInstance: ${error.message}`);
  return data ? rowToInstance(data as WorkflowRow) : null;
}

/** Trouve la dernière instance active (running ou waiting_input) pour ce client */
export async function findActiveInstanceForClient(
  clientId: string,
): Promise<WorkflowInstance | null> {
  if (isDemoMode()) {
    return (
      getDemoStore()
        .filter(
          (i) =>
            i.clientId === clientId &&
            (i.status === "running" || i.status === "waiting_input"),
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
    );
  }
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("workflow_instances")
    .select("*")
    .eq("client_id", clientId)
    .in("status", ["running", "waiting_input"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findActiveInstanceForClient: ${error.message}`);
  return data ? rowToInstance(data as WorkflowRow) : null;
}

export async function updateWorkflowInstance(
  id: string,
  patch: {
    currentStep?: string;
    state?: WorkflowState;
    status?: WorkflowStatus;
    waitingFor?: string | null;
    waitingUntil?: Date | null;
    lastError?: string | null;
  },
): Promise<WorkflowInstance> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const idx = store.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error(`updateWorkflowInstance: instance ${id} introuvable`);
    const current = store[idx];
    const updated: WorkflowInstance = {
      ...current,
      currentStep: patch.currentStep ?? current.currentStep,
      state: patch.state !== undefined ? { ...current.state, ...patch.state } : current.state,
      status: patch.status ?? current.status,
      waitingFor: patch.waitingFor === null ? undefined : (patch.waitingFor ?? current.waitingFor),
      waitingUntil:
        patch.waitingUntil === null ? undefined : (patch.waitingUntil ?? current.waitingUntil),
      lastError: patch.lastError === null ? undefined : (patch.lastError ?? current.lastError),
      updatedAt: new Date(),
      completedAt: patch.status === "completed" ? new Date() : current.completedAt,
    };
    store[idx] = updated;
    return updated;
  }
  const sb = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.currentStep !== undefined) update.current_step = patch.currentStep;
  if (patch.state !== undefined) update.state = patch.state;
  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === "completed") update.completed_at = new Date().toISOString();
  }
  if (patch.waitingFor !== undefined) update.waiting_for = patch.waitingFor;
  if (patch.waitingUntil !== undefined) update.waiting_until = patch.waitingUntil?.toISOString() ?? null;
  if (patch.lastError !== undefined) update.last_error = patch.lastError;

  const { data, error } = await sb
    .from("workflow_instances")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(`updateWorkflowInstance: ${error?.message}`);
  return rowToInstance(data as WorkflowRow);
}

export async function mergeWorkflowState(
  id: string,
  patch: WorkflowState,
): Promise<WorkflowInstance> {
  // Récupère l'état actuel et merge
  const current = await getWorkflowInstance(id);
  if (!current) throw new Error(`mergeWorkflowState: instance ${id} introuvable`);
  const newState = { ...current.state, ...patch };
  return updateWorkflowInstance(id, { state: newState });
}
