/**
 * Skills Registry — regroupe les tools atomiques en COMPÉTENCES user-facing.
 *
 * Pourquoi : 14 tools atomiques c'est lourd à voir en admin. L'admin pense
 * "trier les leads" comme UNE compétence, pas comme 4 tools (parse-csv +
 * normalize-phones + dedup-rows + parse-xlsx).
 *
 * Cette couche regroupe pour l'UI sans toucher au TOOL_REGISTRY (les modules
 * référencent toujours les tools individuellement, c'est le contrat technique).
 *
 * Chaque skill expose :
 * - Identifiant + nom + description user-facing
 * - Liste des tool IDs qu'elle agrège
 * - Zone "instructions" éditable où l'admin écrit comment l'agent doit
 *   utiliser cette compétence (persisté dans skill-instructions.ts)
 */

export type SkillId =
  | "leads-cleaning"
  | "email-read"
  | "email-send"
  | "crm-icall26"
  | "route-optimization"
  | "agent-core";

export interface SkillFolder {
  id: SkillId;
  /** Nom user-facing (visible dans /admin/tools) */
  name: string;
  /** Phrase courte qui décrit ce que l'agent sait faire */
  description: string;
  /** Émoji affiché en avatar */
  emoji: string;
  /** Tools sous-jacents (kebab-case ID dans TOOL_REGISTRY) */
  toolIds: string[];
  /** Catégorie pour le filtre */
  category: "data" | "communication" | "integration" | "utility" | "core";
  /** Couleur Tailwind */
  uiColor: string;
  /** Cas d'usage typiques que l'admin peut affiner */
  useCases: string[];
  /** Instructions par défaut affichées dans la zone "Apprends-moi" */
  defaultInstructions: string;
}

export const SKILL_REGISTRY: SkillFolder[] = [
  {
    id: "leads-cleaning",
    name: "Trier & nettoyer les leads",
    description:
      "À partir d'un fichier (CSV ou Excel) ou d'un email, l'agent extrait les leads, normalise les téléphones, déduplique, prépare l'import CRM.",
    emoji: "📊",
    toolIds: ["parse-csv", "parse-xlsx", "normalize-phones", "dedup-rows"],
    category: "data",
    uiColor: "border-emerald-500/40 bg-emerald-500/5",
    useCases: [
      "Lire un CSV de leads reçu par email et le préparer pour iCall26",
      "Détecter les doublons sur 3 critères (email + téléphone + nom+ville)",
      "Convertir tous les numéros français au format +33...",
      "Importer une liste Excel envoyée par un partenaire",
    ],
    defaultInstructions: `Quand le client donne un fichier de leads :
1. Détecter le format (CSV avec ; ou , / Excel xlsx)
2. Normaliser les numéros au format E.164 (+33...)
3. Détecter et retirer les doublons
4. Marquer les lignes avec données suspectes (gmail générique, champs vides)
5. Demander confirmation avant push CRM`,
  },
  {
    id: "email-read",
    name: "Lire les emails",
    description:
      "L'agent peut lire la boîte Gmail du client (OAuth Google) pour récupérer les emails non lus, fichiers attachés, ou répondre à un sujet précis.",
    emoji: "📧",
    toolIds: ["read-gmail-inbox"],
    category: "communication",
    uiColor: "border-blue-500/40 bg-blue-500/5",
    useCases: [
      "Récupérer les leads envoyés ce matin par email",
      "Trouver les emails clients en attente de réponse > 24h",
      "Extraire les pièces jointes (devis, factures) reçues",
    ],
    defaultInstructions: `Quand le client demande de lire ses emails :
1. Appliquer un filtre (expéditeur / sujet / date / non lus)
2. Limiter à 20 emails max par requête
3. Pour les pièces jointes type Excel/PDF, proposer de les traiter avec d'autres compétences
4. Ne JAMAIS marquer comme lu sans confirmation explicite`,
  },
  {
    id: "email-send",
    name: "Envoyer des emails",
    description:
      "Envoi d'emails transactionnels via Resend : confirmations, devis, factures, rapports, relances. Validation superviseur obligatoire avant envoi.",
    emoji: "✉️",
    toolIds: ["send-email"],
    category: "communication",
    uiColor: "border-orange-500/40 bg-orange-500/5",
    useCases: [
      "Envoyer le devis généré au client",
      "Relance impayé (J+15 / J+30 / J+45)",
      "Confirmation de RDV chantier",
      "Rapport hebdomadaire automatique",
    ],
    defaultInstructions: `Avant chaque envoi d'email :
1. Vérifier le destinataire (pas de gmail générique sans contexte)
2. Adapter le ton au secteur du client (formel pour compta, chaleureux pour BTP)
3. Inclure une signature (à apprendre par client)
4. Le superviseur valide AVANT l'envoi (cohérence sujet/corps, ton, destinataire)`,
  },
  {
    id: "crm-icall26",
    name: "Gérer le CRM iCall26",
    description:
      "Lecture et écriture dans le CRM solaire iCall26 : créer des leads, lire les RDV, suivre la performance commerciale.",
    emoji: "📞",
    toolIds: [
      "push-icall26",
      "read-icall26-leads",
      "read-icall26-appointments",
      "read-icall26-sales-performance",
    ],
    category: "integration",
    uiColor: "border-cyan-500/40 bg-cyan-500/5",
    useCases: [
      "Pousser une liste de leads nettoyés dans iCall26",
      "Voir les RDV de la semaine pour planning commercial",
      "Stats de conversion par téléprospecteur",
      "Récupérer les leads chauds non rappelés",
    ],
    defaultInstructions: `Pour iCall26 :
1. Avant push : vérifier que les leads sont nettoyés (téléphones E.164, pas de doublons)
2. Mapping colonnes par défaut : nom → contact_name, telephone → phone, email → email
3. Pour les lectures : limiter à 50 lignes par requête
4. Toujours valider via superviseur avant push (action irréversible)`,
  },
  {
    id: "route-optimization",
    name: "Optimiser les tournées",
    description:
      "Algorithme VRP qui ordonne N RDV pour minimiser le temps total de trajet, avec contrainte max 1h-1h30 entre 2 RDV (commerciaux terrain).",
    emoji: "🚗",
    toolIds: ["optimize-route"],
    category: "utility",
    uiColor: "border-purple-500/40 bg-purple-500/5",
    useCases: [
      "Tournée Marc demain : 8 RDV sur Paris + banlieue",
      "Planning hebdo de l'équipe terrain (3 commerciaux)",
      "Simuler l'ajout d'un RDV et voir l'impact sur la tournée existante",
    ],
    defaultInstructions: `Optimisation tournées :
1. Géocoder toutes les adresses avant calcul
2. Contrainte : max 1h-1h30 entre 2 RDV consécutifs
3. Démarrer depuis le domicile du commercial (homeAddress)
4. Output : ordre + horaires + temps de trajet + lien Google Maps cliquable
5. Si > 8 RDV/jour, alerter le client (sur-sollicitation)`,
  },
  {
    id: "agent-core",
    name: "Mémoire & auto-amélioration",
    description:
      "Compétences internes qui permettent à l'agent de retenir des faits clients, proposer ses propres apprentissages à valider, et lancer des modules.",
    emoji: "🧠",
    toolIds: ["remember-fact", "propose-learning", "run-module"],
    category: "core",
    uiColor: "border-pink-500/40 bg-pink-500/5",
    useCases: [
      "Retenir : 'le commercial Marc préfère les RDV le matin'",
      "Proposer une amélioration : 'quand client mentionne Lyon, ajouter le code postal 69'",
      "Lancer le module lead-cleaning sur un fichier",
    ],
    defaultInstructions: `Compétences internes (toujours actives) :
- L'agent peut mémoriser des faits clients à tout moment (sans demander)
- L'agent propose des apprentissages quand il détecte un pattern récurrent ; l'admin valide
- L'agent peut lancer un module quand le client en a fait la demande explicite`,
  },
];

export function getSkillById(id: string): SkillFolder | undefined {
  return SKILL_REGISTRY.find((s) => s.id === id);
}

/** Map inverse : pour un tool donné, à quelle skill il appartient */
const skillByToolId = new Map<string, SkillFolder>();
for (const s of SKILL_REGISTRY) {
  for (const tid of s.toolIds) {
    skillByToolId.set(tid, s);
  }
}
export function getSkillByToolId(toolId: string): SkillFolder | undefined {
  return skillByToolId.get(toolId);
}
