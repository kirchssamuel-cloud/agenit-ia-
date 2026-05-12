import "server-only";
import {
  createWorkflowInstance,
  getWorkflowInstance,
  updateWorkflowInstance,
  mergeWorkflowState,
} from "./db";
import { getWorkflowByName } from "./registry";
import type {
  ActionContext,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowState,
} from "./types";

const MAX_STEPS_PER_RUN = 20; // anti-boucle infinie

/**
 * Workflow engine — exécute les workflows définis dans le registry.
 *
 * Modèle : un workflow = liste de steps. Chaque step exécute une action et
 * retourne un ActionResult qui dit quoi faire ensuite :
 *  - next   → step suivant dans le tableau
 *  - goto   → step nommé spécifique
 *  - wait_input → suspend, attend message externe
 *  - complete → terminé
 *  - fail   → erreur fatale
 *
 * Persistance : à chaque transition, on save state + currentStep en DB.
 * Reprise : continueWorkflowWithInput(instanceId, externalInput) reprend
 * depuis l'étape courante après un wait_input.
 */

function buildContext(instance: WorkflowInstance): ActionContext {
  return {
    instance,
    log: (level, msg, data) => {
      const prefix = `[wf:${instance.workflowName}:${instance.id.slice(0, 8)}]`;
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      if (data !== undefined) {
        fn(`${prefix} ${msg}`, data);
      } else {
        fn(`${prefix} ${msg}`);
      }
    },
    updateState: async (patch: WorkflowState) => {
      const updated = await mergeWorkflowState(instance.id, patch);
      // Mutation in-place du contexte pour que la suite de l'exécution voie
      // les valeurs fraîches sans re-fetch (économie d'IO Supabase).
      instance.state = updated.state;
    },
  };
}

function findNextStepId(
  def: WorkflowDefinition,
  currentStepId: string,
): string | null {
  const idx = def.steps.findIndex((s) => s.id === currentStepId);
  if (idx < 0) return null;
  const next = def.steps[idx + 1];
  return next?.id ?? null;
}

function findStep(def: WorkflowDefinition, stepId: string) {
  return def.steps.find((s) => s.id === stepId);
}

/**
 * Démarre un nouveau workflow pour un client donné.
 * Retourne l'instance après exécution synchrone (jusqu'à wait_input / complete / fail).
 */
export async function startWorkflow(input: {
  clientId: string;
  workflowName: string;
  initialState?: WorkflowState;
  conversationId?: string;
}): Promise<WorkflowInstance> {
  const def = getWorkflowByName(input.workflowName);
  if (!def) {
    throw new Error(`Workflow inconnu : ${input.workflowName}`);
  }

  const startStepId = def.startStep ?? def.steps[0]?.id;
  if (!startStepId) {
    throw new Error(`Workflow ${input.workflowName} n'a pas de steps`);
  }

  const instance = await createWorkflowInstance({
    clientId: input.clientId,
    workflowName: input.workflowName,
    startStep: startStepId,
    initialState: input.initialState,
    conversationId: input.conversationId,
  });

  return runUntilPause(instance);
}

/**
 * Reprend un workflow suspendu (status=waiting_input) après réception d'un
 * input externe (réponse user, callback, etc.).
 *
 * L'input est merge dans state sous la clé `lastInput` pour que le step
 * suivant puisse le lire.
 */
export async function continueWorkflowWithInput(
  instanceId: string,
  input: { text: string; meta?: Record<string, unknown> },
): Promise<WorkflowInstance> {
  let instance = await getWorkflowInstance(instanceId);
  if (!instance) throw new Error(`Instance ${instanceId} introuvable`);

  if (instance.status !== "waiting_input") {
    console.warn(
      `[wf] continueWorkflow: instance ${instanceId} n'est pas en waiting_input (status=${instance.status})`,
    );
    return instance;
  }

  // Inject l'input dans state
  await mergeWorkflowState(instance.id, {
    lastInput: { text: input.text, meta: input.meta, receivedAt: new Date().toISOString() },
  });

  // Reset le wait flag pour pouvoir reprendre
  instance = await updateWorkflowInstance(instance.id, {
    status: "running",
    waitingFor: null,
    waitingUntil: null,
  });

  return runUntilPause(instance);
}

/**
 * Boucle d'exécution synchrone — exécute les steps jusqu'à pause/fin.
 */
async function runUntilPause(initial: WorkflowInstance): Promise<WorkflowInstance> {
  const def = getWorkflowByName(initial.workflowName);
  if (!def) {
    return updateWorkflowInstance(initial.id, {
      status: "failed",
      lastError: `Workflow inconnu : ${initial.workflowName}`,
    });
  }

  let instance = initial;
  let iter = 0;

  while (iter < MAX_STEPS_PER_RUN) {
    iter++;

    const step = findStep(def, instance.currentStep);
    if (!step) {
      return updateWorkflowInstance(instance.id, {
        status: "failed",
        lastError: `Step inconnu : ${instance.currentStep}`,
      });
    }

    const ctx = buildContext(instance);
    ctx.log("info", `exec step "${step.id}" — ${step.description}`);

    let result;
    try {
      result = await step.execute(ctx);
    } catch (err) {
      ctx.log("error", `step "${step.id}" exception : ${(err as Error).message}`);
      return updateWorkflowInstance(instance.id, {
        status: "failed",
        lastError: `[${step.id}] ${(err as Error).message}`,
      });
    }

    switch (result.type) {
      case "next": {
        const nextId = findNextStepId(def, instance.currentStep);
        if (!nextId) {
          // Fin du tableau steps → complete par défaut
          return updateWorkflowInstance(instance.id, { status: "completed" });
        }
        instance = await updateWorkflowInstance(instance.id, { currentStep: nextId });
        break;
      }
      case "goto": {
        instance = await updateWorkflowInstance(instance.id, { currentStep: result.stepId });
        break;
      }
      case "wait_input": {
        const timeoutHours = result.timeoutHours ?? 24;
        const waitingUntil = new Date(Date.now() + timeoutHours * 3600_000);
        return updateWorkflowInstance(instance.id, {
          status: "waiting_input",
          waitingFor: result.waitingFor,
          waitingUntil,
        });
      }
      case "complete": {
        if (result.result) {
          await mergeWorkflowState(instance.id, result.result);
        }
        return updateWorkflowInstance(instance.id, { status: "completed" });
      }
      case "fail": {
        return updateWorkflowInstance(instance.id, {
          status: "failed",
          lastError: result.error,
        });
      }
    }
  }

  // Garde-fou anti-boucle infinie
  return updateWorkflowInstance(instance.id, {
    status: "failed",
    lastError: `MAX_STEPS_PER_RUN (${MAX_STEPS_PER_RUN}) atteint — boucle suspecte`,
  });
}
