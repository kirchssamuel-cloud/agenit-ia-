import type { LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { ToolContext } from "@/agent/tools/types";

export type ModuleCategory =
  | "leads"
  | "scheduling"
  | "communication"
  | "accounting"
  | "documents"
  | "other";

/**
 * Un trigger : ce qui déclenche un module.
 * - cron : exécution périodique (ex: tous les matins à 8h)
 * - webhook : appelé par un système externe
 * - manual : déclenché depuis l'interface admin
 * - whatsapp : message entrant sur le numéro Ziv
 */
export type TriggerKind = "cron" | "webhook" | "manual" | "whatsapp";

export interface ModuleRunContext<TConfig> extends ToolContext {
  config: TConfig;
  /** Données passées au lancement (fichier uploadé, payload webhook, message WA, etc.) */
  payload: unknown;
}

export interface ModuleRunResult {
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ModuleDefinition<TConfig extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;
  name: string;
  shortDescription: string;
  longDescription?: string;
  category: ModuleCategory;
  icon: LucideIcon;
  version: string;
  status: "stable" | "beta" | "alpha";
  pricing?: {
    monthlyEUR?: number;
    perUseEUR?: number;
  };
  /** Tools nécessaires au module (IDs depuis TOOL_REGISTRY) */
  tools: string[];
  /** Comment ce module est déclenché */
  triggers: TriggerKind[];
  configSchema?: TConfig;
  defaultConfig?: TConfig extends z.ZodTypeAny ? z.infer<TConfig> : never;
  /** Logique d'exécution. Reçoit la config du client + le payload + accès aux tools. */
  run?: (
    ctx: ModuleRunContext<TConfig extends z.ZodTypeAny ? z.infer<TConfig> : unknown>,
  ) => Promise<ModuleRunResult>;
}

export type AnyModuleDefinition = ModuleDefinition<z.ZodTypeAny>;
