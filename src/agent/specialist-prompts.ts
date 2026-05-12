import "server-only";

/**
 * Specialist prompts — couches d'expertise qu'on injecte dans le system
 * prompt selon le contexte détecté.
 *
 * Idée : au lieu d'avoir 4 agents séparés (devis, email, crm, general)
 * qui dupliquent l'historique et le contexte, on garde UN seul agent
 * (brain.ts) et on lui injecte une "casquette spécialisée" selon le
 * sujet courant.
 *
 * Avantages vs l'archi multi-agents stricte :
 * - Pas de Map RAM in-process (incompatible serverless Vercel)
 * - Pas de filtrage historique par keyword (fragile, perd du contexte)
 * - Réutilise toute l'infra existante (mémoire DB, knowledge base,
 *   tool use loop, supervisor) sans la dupliquer
 * - Une seule conversation, ordre temporel intact
 *
 * L'agent décide LUI-MÊME comment réagir grâce au prompt enrichi, plutôt
 * que de passer par un router fragile par regex.
 */

export type SpecialistKind = "devis" | "email" | "crm" | null;

interface SpecialistDef {
  kind: SpecialistKind;
  /** Mots / patterns qui indiquent que ce mode est pertinent */
  triggers: RegExp[];
  /** Casquette injectée dans le system prompt */
  prompt: string;
}

const SPECIALISTS: SpecialistDef[] = [
  {
    kind: "devis",
    triggers: [
      /devis/i,
      /tarif/i,
      /prix/i,
      /\bcombien\b/i,
      /co[uû]te/i,
      /m[²2]/i,
      /facture/i,
      /marge/i,
      /calcul/i,
    ],
    prompt: `# Casquette spécialisée — Devis & calcul

Ce qui suit est l'expertise que tu dois prioriser pour ce message :

- Tu génères des devis structurés. Pas de blabla.
- Pour calculer un devis, tu as besoin de **3 infos** : surface (m²), type de travaux (carrelage / peinture / plomberie / ...), gamme (budget / moyen / premium). Si l'une manque, demande-la — **mais une seule à la fois** (pas un questionnaire).
- Formule de base : prix_m² × surface × marge_artisan. Marge par défaut = 1.4. TVA 10% en rénovation principale > 2 ans, 20% sinon.
- Si l'user demande "+X%" ou "-X%", ajuste la marge multiplicatrice et recalcule. Confirme le nouveau total.
- Si tu as toutes les infos, propose le total immédiatement et demande validation avant tout envoi.
- Si un workflow devis-btp est déjà actif (voir state plus bas), ne re-démarre pas : continue dedans.`,
  },
  {
    kind: "email",
    triggers: [
      /envoie un (?:e?-?mail|mail)/i,
      /envoyer un (?:e?-?mail|mail)/i,
      /[\w._%+-]+@[\w.-]+\.[a-z]{2,}/i,
      /\bgmail\b/i,
      /boîte mail/i,
      /relance/i,
    ],
    prompt: `# Casquette spécialisée — Email

Ce qui suit est l'expertise que tu dois prioriser pour ce message :

- Avant tout envoi email, tu **confirmes** : destinataire (vérifie le @), sujet, corps. Toujours.
- Tu écris en français, ton pro mais humain. Pas de "Cordialement" si la conversation est casual. Adapte.
- Si l'user te dit "envoie le devis", cherche d'abord le devis dans la conversation récente ou dans un workflow actif. Si tu n'en trouves pas, demande de quel devis il parle.
- Avant d'envoyer, présente le brouillon à l'user pour validation finale (sauf s'il a explicitement dit "vas-y direct").
- Tu as accès au tool send-email pour envoyer.`,
  },
  {
    kind: "crm",
    triggers: [
      /\bcrm\b/i,
      /\blead\b/i,
      /prospect/i,
      /icall26/i,
      /hubspot/i,
      /pipedrive/i,
      /\brelance\b/i,
      /pousser? un? .*(?:client|lead)/i,
    ],
    prompt: `# Casquette spécialisée — CRM

Ce qui suit est l'expertise que tu dois prioriser pour ce message :

- Quand l'user te demande de pousser un lead, vérifie que tu as : nom, téléphone (ou email), source, statut. Si ça manque, demande.
- Tu utilises le tool push-icall26 pour iCall26 (en mode mock si l'API n'est pas branchée — tu signales alors "j'ai noté en attendant l'API").
- Si l'user demande "relance Mme Dupond", cherche d'abord son historique dans la mémoire ou via read-icall26-leads. Si tu n'as rien, demande son numéro/email.
- Pour les actions critiques (push réel, modif statut), tu confirmes toujours avant. Le superviseur valide aussi.`,
  },
];

/**
 * Sélectionne la casquette spécialisée pertinente pour ce message, OU null
 * si aucun pattern ne matche (agent reste en mode "general", inchangé).
 *
 * Si plusieurs casquettes matchent, on prend la 1ère dans l'ordre du
 * tableau (priorité : devis > email > crm). Volontairement simpliste — pas
 * de scoring élaboré pour V1.
 */
export function pickSpecialist(userMessage: string): SpecialistDef | null {
  for (const def of SPECIALISTS) {
    if (def.triggers.some((rx) => rx.test(userMessage))) {
      return def;
    }
  }
  return null;
}

/**
 * Bloc de contexte workflow à injecter quand un workflow est actif pour
 * ce client. Permet à l'agent de savoir où on en est et de continuer
 * cohéremment au lieu de redémarrer un nouveau.
 */
export function buildWorkflowContextBlock(input: {
  workflowName: string;
  currentStep: string;
  status: string;
  state: Record<string, unknown>;
}): string {
  const lines: string[] = [];
  lines.push(`# Workflow actif pour ce client`);
  lines.push(``);
  lines.push(`- Nom : **${input.workflowName}**`);
  lines.push(`- Étape courante : ${input.currentStep}`);
  lines.push(`- Statut : ${input.status}`);
  lines.push(``);
  lines.push(`État partagé (peut être consulté pour cohérence) :`);
  lines.push("```json");
  lines.push(JSON.stringify(sanitizeWorkflowState(input.state), null, 2));
  lines.push("```");
  lines.push(``);
  lines.push(
    `Si l'user pose une question liée à ce workflow, utilise cet état comme source de vérité au lieu de redemander.`,
  );
  return lines.join("\n");
}

/**
 * Purge les gros blobs binaires (pdfBase64) avant d'injecter dans le
 * prompt — sinon on gaspille des milliers de tokens pour rien.
 */
function sanitizeWorkflowState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (k === "pdfBase64") {
      out[k] = `<binary ${typeof v === "string" ? `${v.length} chars` : "absent"}>`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
