import type { z } from "zod";

export type ToolCategory =
  | "data"
  | "communication"
  | "integration"
  | "documents"
  | "ai"
  | "utility";

export interface ToolContext {
  clientId: string;
  moduleId?: string;
  runId: string;
  /** Config du module pour ce client (résolu depuis client_modules.config) */
  moduleConfig?: Record<string, unknown>;
  /** Logger structuré pour le run en cours */
  log: (level: "info" | "warn" | "error", message: string, data?: unknown) => void;
}

export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> {
  /** Identifiant stable, en kebab-case. Ne jamais le renommer (référencé en base). */
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  /** Si true, expose au LLM via Claude tool use. Si false, helper interne. */
  exposedToLLM: boolean;
  inputSchema: TInput;
  /** Coût estimé pour reporting (cents). Optionnel. */
  costEstimateCents?: number;
  execute: (input: z.infer<TInput>, ctx: ToolContext) => Promise<TOutput>;
}

export type AnyTool = ToolDefinition<z.ZodTypeAny, unknown>;
