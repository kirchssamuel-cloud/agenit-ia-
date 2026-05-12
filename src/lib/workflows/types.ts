import "server-only";
import type { z } from "zod";

/**
 * Workflow types — moteur état-machine pour orchestrer des suites d'actions
 * multi-tours (devis, facture, relance, etc.).
 */

/** État JSONB d'une instance de workflow — flexible, propre à chaque template */
export type WorkflowState = Record<string, unknown>;

export type WorkflowStatus =
  | "running" // en cours d'exécution synchrone
  | "waiting_input" // en attente d'un message externe (user, callback, etc.)
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowInstance {
  id: string;
  clientId: string;
  workflowName: string;
  currentStep: string;
  state: WorkflowState;
  status: WorkflowStatus;
  conversationId?: string;
  waitingFor?: string;
  waitingUntil?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Contexte passé à chaque action — donne accès à l'instance + helpers.
 */
export interface ActionContext {
  instance: WorkflowInstance;
  /** Log structuré (apparaît dans les logs Vercel) */
  log: (level: "info" | "warn" | "error", msg: string, data?: unknown) => void;
  /** Mettre à jour le state JSONB (merge shallow) */
  updateState: (patch: WorkflowState) => Promise<void>;
}

/**
 * Résultat d'une action. Détermine la suite du workflow.
 */
export type ActionResult =
  /** Aller à un step donné, exécution continue */
  | { type: "goto"; stepId: string }
  /** Suspendre l'exécution, attendre input externe (user, callback) */
  | { type: "wait_input"; waitingFor: string; timeoutHours?: number }
  /** Workflow terminé avec succès */
  | { type: "complete"; result?: WorkflowState }
  /** Erreur fatale — arrête le workflow */
  | { type: "fail"; error: string }
  /** Continuer au step suivant (next dans l'ordre du tableau steps) */
  | { type: "next" };

export interface WorkflowStep {
  /** ID unique du step dans le workflow (ex: "extract", "calculate", "send_owner") */
  id: string;
  /** Description humaine (apparaît dans les logs) */
  description: string;
  /** Logique exécutée par ce step */
  execute: (ctx: ActionContext) => Promise<ActionResult>;
}

/**
 * Trigger qui déclenche le workflow.
 */
export type WorkflowTrigger =
  /** Déclenché si un message inbound matche le pattern */
  | { type: "message_match"; pattern: RegExp; description: string }
  /** Déclenché par un email entrant (sera ajouté plus tard via Gmail webhook) */
  | { type: "email_match"; subjectPattern?: RegExp; bodyPattern?: RegExp }
  /** Déclenché manuellement via API */
  | { type: "manual" };

export interface WorkflowDefinition<TInitial extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Nom unique (snake_case) — stocké en DB */
  name: string;
  /** Description humaine */
  description: string;
  /** Version du template (incrémenter en cas de breaking change) */
  version: string;
  /** Quand ce workflow se déclenche */
  triggers: WorkflowTrigger[];
  /** Schema des données initiales requises pour démarrer */
  initialDataSchema?: TInitial;
  /** Liste ordonnée des steps. ID unique par step. */
  steps: WorkflowStep[];
  /** Step de départ (par défaut : 1er step du tableau) */
  startStep?: string;
}
