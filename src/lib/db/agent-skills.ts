import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SkillExample {
  user: string;
  agent: string;
}

export type SkillStatus = "draft" | "active" | "archived";

export interface AgentSkill {
  id: string;
  name: string;
  description: string | null;
  triggerPattern: string | null;
  actionTemplate: string | null;
  examples: SkillExample[];
  moduleId: string | null;
  clientScope: string;
  status: SkillStatus;
  successCount: number;
  usesCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  trigger_pattern: string | null;
  action_template: string | null;
  examples: SkillExample[];
  module_id: string | null;
  client_scope: string;
  status: SkillStatus;
  success_count: number;
  uses_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSkill(r: SkillRow): AgentSkill {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    triggerPattern: r.trigger_pattern,
    actionTemplate: r.action_template,
    examples: r.examples ?? [],
    moduleId: r.module_id,
    clientScope: r.client_scope,
    status: r.status,
    successCount: r.success_count,
    usesCount: r.uses_count,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listSkills(): Promise<AgentSkill[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_skills")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listSkills: ${error.message}`);
  return (data ?? []).map((r) => rowToSkill(r as SkillRow));
}

export async function createSkill(input: {
  name: string;
  description?: string;
  triggerPattern?: string;
  actionTemplate?: string;
  examples?: SkillExample[];
  moduleId?: string;
  clientScope?: string;
  status?: SkillStatus;
}): Promise<AgentSkill> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_skills")
    .insert({
      name: input.name,
      description: input.description ?? null,
      trigger_pattern: input.triggerPattern ?? null,
      action_template: input.actionTemplate ?? null,
      examples: input.examples ?? [],
      module_id: input.moduleId ?? null,
      client_scope: input.clientScope ?? "all",
      status: input.status ?? "draft",
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createSkill: ${error?.message}`);
  return rowToSkill(data as SkillRow);
}

export async function updateSkill(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    triggerPattern: string | null;
    actionTemplate: string | null;
    examples: SkillExample[];
    status: SkillStatus;
  }>,
): Promise<AgentSkill> {
  const sb = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.triggerPattern !== undefined) update.trigger_pattern = patch.triggerPattern;
  if (patch.actionTemplate !== undefined) update.action_template = patch.actionTemplate;
  if (patch.examples !== undefined) update.examples = patch.examples;
  if (patch.status !== undefined) update.status = patch.status;
  const { data, error } = await sb
    .from("agent_skills")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(`updateSkill: ${error?.message}`);
  return rowToSkill(data as SkillRow);
}

export async function deleteSkill(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("agent_skills").delete().eq("id", id);
  if (error) throw new Error(`deleteSkill: ${error.message}`);
}

// Learnings ---------------------------------------------------------------

export type LearningType =
  | "correction"
  | "new_skill"
  | "improvement"
  | "auto_fix";

export interface AgentLearning {
  id: string;
  type: LearningType;
  skillId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  approvedByAdmin: boolean;
  approvedAt: string | null;
  createdAt: string;
}

interface LearningRow {
  id: string;
  type: LearningType;
  skill_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  approved_by_admin: boolean;
  approved_at: string | null;
  created_at: string;
}

export async function listLearnings(limit = 30): Promise<AgentLearning[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("agent_learnings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listLearnings: ${error.message}`);
  return (data ?? []).map((r) => {
    const row = r as LearningRow;
    return {
      id: row.id,
      type: row.type,
      skillId: row.skill_id,
      beforeState: row.before_state,
      afterState: row.after_state,
      reason: row.reason,
      approvedByAdmin: row.approved_by_admin,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    };
  });
}

export async function approveLearning(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from("agent_learnings")
    .update({ approved_by_admin: true, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`approveLearning: ${error.message}`);
}
