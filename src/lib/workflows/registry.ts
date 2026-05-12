import "server-only";
import type { WorkflowDefinition } from "./types";
import { devisBtpWorkflow } from "./templates/devis-btp";

/**
 * Registre central des workflows disponibles.
 *
 * Ajouter un nouveau workflow = créer le template dans /templates/, l'importer
 * ici, l'ajouter au WORKFLOW_REGISTRY array. Pas de DB seed nécessaire — les
 * workflows sont en code, seules les instances sont en DB.
 */

export const WORKFLOW_REGISTRY: WorkflowDefinition[] = [devisBtpWorkflow];

export function getWorkflowByName(name: string): WorkflowDefinition | undefined {
  return WORKFLOW_REGISTRY.find((w) => w.name === name);
}

/**
 * Cherche un workflow dont l'un des triggers de type `message_match`
 * matche le texte. Retourne le 1er match (pas de scoring pour V1).
 */
export function findWorkflowForMessage(text: string): WorkflowDefinition | undefined {
  for (const wf of WORKFLOW_REGISTRY) {
    for (const trigger of wf.triggers) {
      if (trigger.type === "message_match" && trigger.pattern.test(text)) {
        return wf;
      }
    }
  }
  return undefined;
}
