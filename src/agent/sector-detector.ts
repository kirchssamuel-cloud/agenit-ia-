import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Détecteur de secteur métier pour l'auto-onboarding.
 *
 *   1er message du client →  Sector Detector  →  { sector, confidence }
 *                                    ↓
 *                          stocké dans client_context.sector
 *                                    ↓
 *                          system prompt enrichi avec vocabulaire métier
 *
 * On utilise Claude Haiku (cheap + fast, ~5ms) pour classifier en 6 secteurs.
 * Fallback keywords si pas de clé Anthropic.
 */

export type SectorId =
  | "btp"
  | "comptabilite"
  | "commercial"
  | "ecommerce"
  | "services"
  | "autre";

export interface SectorDetectionResult {
  sector: SectorId;
  confidence: number;
  reason: string;
  /** True si la détection vient du LLM, false si keyword fallback */
  llmDetected: boolean;
  costCents: number;
}

interface SectorMeta {
  id: SectorId;
  name: string;
  /** Mots-clés indicatifs pour le fallback keyword (ordre = priorité) */
  keywords: string[];
  /** Vocabulaire métier injecté dans le system prompt */
  glossary: string[];
  /** Règles métier critiques injectées dans le system prompt */
  rules: string[];
}

export const SECTOR_REGISTRY: Record<SectorId, SectorMeta> = {
  btp: {
    id: "btp",
    name: "BTP / Artisanat",
    keywords: [
      "carrelage",
      "carreleur",
      "plombier",
      "plomberie",
      "électricien",
      "électricité",
      "peintre",
      "maçon",
      "maçonnerie",
      "menuisier",
      "couvreur",
      "chauffagiste",
      "chantier",
      "btp",
      "artisan",
      "rénovation",
      "ravalement",
      "rge",
      "qualibat",
      "devis travaux",
    ],
    glossary: ["m²", "ml", "FPC (fourniture pose comprise)", "TVA 10% rénovation", "acompte 30%", "DTU"],
    rules: [
      "Marges typiques : 25-35% main-d'œuvre, 15-25% matériaux",
      "Validité devis par défaut : 3 mois",
      "Acompte 30% à la signature, solde à la fin",
      "TVA 10% pour rénovation logement >2 ans, 20% pour neuf",
    ],
  },
  comptabilite: {
    id: "comptabilite",
    name: "Comptabilité",
    keywords: [
      "comptable",
      "comptabilité",
      "expert-comptable",
      "tva",
      "fec",
      "pennylane",
      "tiime",
      "dext",
      "sage",
      "cegid",
      "ebp",
      "ca3",
      "ca12",
      "rapprochement",
      "lettrage",
      "fiscalité",
      "bilan",
      "compte de résultat",
    ],
    glossary: ["FEC", "TVA collectée/déductible", "CA3", "CA12", "compte 411", "compte 401", "BIC/BNC/BA", "IS/IR"],
    rules: [
      "Déclaration TVA : 19 du mois (CA3) ou 1er mai (CA12)",
      "Relance impayé : J+15 doux, J+30 mise en demeure, J+45 recouvrement",
      "Toujours préciser HT et TTC dans les chiffres",
      "Plafonds micro 2026 : 188 700€ BIC vente, 77 700€ BIC services/BNC",
    ],
  },
  commercial: {
    id: "commercial",
    name: "Commercial / Vente",
    keywords: [
      "commercial",
      "vente",
      "lead",
      "prospect",
      "rdv",
      "tournée",
      "porte-à-porte",
      "agent immobilier",
      "vrp",
      "régie",
      "icall26",
      "hubspot",
      "pipedrive",
      "salesforce",
      "panneaux solaires",
      "closing",
      "pipeline",
      "mandat",
    ],
    glossary: ["lead", "RDV qualifié", "closing", "pipeline", "tournée", "MQL/SQL", "panier moyen", "taux de conversion"],
    rules: [
      "Tournées : max 1h-1h30 entre 2 RDV, optimiser géographiquement",
      "Relance : J+1 post-RDV, J+3 si pas de retour, J+7 mise au point, J+15 dernière chance",
      "Toujours respecter le RGPD : opt-out clair dans les emails",
      "Adapter le ton au statut : chaud → appel, tiède → email, froid → newsletter",
    ],
  },
  ecommerce: {
    id: "ecommerce",
    name: "E-commerce",
    keywords: [
      "ecommerce",
      "e-commerce",
      "shopify",
      "woocommerce",
      "prestashop",
      "magento",
      "etsy",
      "amazon",
      "boutique en ligne",
      "panier",
      "livraison",
      "tracking",
      "sav",
      "retour",
      "remboursement",
      "stock",
      "commande",
      "expédition",
      "mondial relay",
      "chronopost",
      "colissimo",
    ],
    glossary: ["panier moyen", "AOV", "taux de conversion", "tracking", "avoir", "geste commercial", "panier abandonné"],
    rules: [
      "SAV : répondre en moins de 24h",
      "Retours : 14 jours minimum (loi européenne)",
      "Avoir vs remboursement : proposer avoir d'abord",
      "Relance panier abandonné : J+1 doux, J+3 offre -10%, J+7 dernière chance",
      "Litige tracking 'livré' mais non reçu → réclamation transporteur d'abord",
    ],
  },
  services: {
    id: "services",
    name: "Services / Bien-être",
    keywords: [
      "coiffeur",
      "barbier",
      "esthéticienne",
      "esthétique",
      "massage",
      "masseur",
      "coach sportif",
      "thérapeute",
      "psychologue",
      "psy",
      "ostéopathe",
      "ostéo",
      "kiné",
      "naturopathe",
      "doctolib",
      "calendly",
      "treatwell",
      "soin",
      "consultation",
      "séance",
    ],
    glossary: ["RDV", "créneau", "soin", "séance", "no-show", "carte de fidélité", "forfait"],
    rules: [
      "Rappel RDV : J-1 (la veille), -30% de no-shows",
      "Annulation : politique 24h minimum",
      "Confirmation par email/SMS dès la prise",
      "Premier RDV : envoyer infos pratiques (adresse, durée, tarif, contre-indications)",
      "RGPD santé : si données médicales, droit à l'oubli renforcé",
    ],
  },
  autre: {
    id: "autre",
    name: "Autre / Non classé",
    keywords: [],
    glossary: [],
    rules: [],
  },
};

/**
 * Fallback keyword-based : compte les matches dans le texte, retourne le secteur
 * avec le plus de matches. Confiance = ratio (nb matches / longueur des mots).
 */
function detectByKeywords(text: string): SectorDetectionResult {
  const lower = text.toLowerCase();
  let bestSector: SectorId = "autre";
  let bestCount = 0;
  let bestMatches: string[] = [];

  for (const [id, meta] of Object.entries(SECTOR_REGISTRY)) {
    if (id === "autre") continue;
    const matches = meta.keywords.filter((kw) => lower.includes(kw));
    if (matches.length > bestCount) {
      bestCount = matches.length;
      bestSector = id as SectorId;
      bestMatches = matches;
    }
  }

  if (bestCount === 0) {
    return {
      sector: "autre",
      confidence: 0,
      reason: "Aucun mot-clé secteur détecté dans le message.",
      llmDetected: false,
      costCents: 0,
    };
  }

  // Confiance approximative : 0.4 base + 0.15 par match supplémentaire
  const confidence = Math.min(0.95, 0.4 + (bestCount - 1) * 0.15);
  return {
    sector: bestSector,
    confidence,
    reason: `Mots-clés détectés : ${bestMatches.slice(0, 5).join(", ")}.`,
    llmDetected: false,
    costCents: 0,
  };
}

const DETECTOR_MODEL = "claude-haiku-4-5";
const DETECTOR_MAX_TOKENS = 200;

const DETECTOR_SYSTEM = `Tu es un classifieur de secteur métier pour une plateforme d'agents IA pour PME.

Tu lis le message d'un client (premier contact, pas encore catégorisé) et tu identifies son secteur d'activité parmi :
- "btp" : artisans BTP (carreleur, plombier, électricien, peintre, maçon, menuisier, couvreur, chauffagiste)
- "comptabilite" : expert-comptable, comptable indépendant, cabinet comptable
- "commercial" : agent immobilier, VRP, régie panneaux solaires, technico-commercial, porte-à-porte
- "ecommerce" : Shopify, WooCommerce, PrestaShop, Etsy, marketplaces, boutique en ligne
- "services" : coiffeur, barbier, esthéticienne, masseur, coach, thérapeute, ostéo, prof particulier
- "autre" : si aucun ne matche clairement

Tu réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "sector": "btp" | "comptabilite" | "commercial" | "ecommerce" | "services" | "autre",
  "confidence": 0.0 à 1.0,
  "reason": "phrase courte expliquant pourquoi"
}

Si tu hésites entre 2 secteurs, choisis le plus probable et indique la nuance dans "reason".`;

interface DetectorJSONResponse {
  sector?: string;
  confidence?: number;
  reason?: string;
}

function parseDetectorResponse(text: string): DetectorJSONResponse | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as DetectorJSONResponse;
  } catch {
    return null;
  }
}

function isValidSector(s: unknown): s is SectorId {
  return (
    typeof s === "string" &&
    (Object.keys(SECTOR_REGISTRY) as string[]).includes(s)
  );
}

/**
 * Détecte le secteur métier d'un client à partir d'un message libre.
 *
 * Stratégie en 2 niveaux :
 * 1. Si ANTHROPIC_API_KEY → Claude Haiku (précis, ~5ms, < 0.01¢)
 * 2. Sinon → keyword matching (gratuit, instantané, moins précis)
 *
 * Le résultat est ensuite stocké dans `client_context.sector` par l'appelant.
 */
export async function detectSector(
  message: string,
): Promise<SectorDetectionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return detectByKeywords(message);
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: DETECTOR_MODEL,
      max_tokens: DETECTOR_MAX_TOKENS,
      system: [
        {
          type: "text",
          text: DETECTOR_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Message du client à classifier :\n"""\n${message.slice(0, 2000)}\n"""`,
        },
      ],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const parsed = parseDetectorResponse(textBlock?.text ?? "");

    // Coût Haiku 4.5 : ~$1/M input, $5/M output
    const costCents = Math.round(
      (response.usage.input_tokens / 1_000_000) * 100 +
        (response.usage.output_tokens / 1_000_000) * 500,
    );

    if (!parsed || !isValidSector(parsed.sector)) {
      // Fallback keywords si réponse inexploitable
      const fallback = detectByKeywords(message);
      return { ...fallback, costCents, reason: `LLM inexploitable, fallback keywords. ${fallback.reason}` };
    }

    return {
      sector: parsed.sector,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.6,
      reason: parsed.reason ?? "Classifié par Claude Haiku.",
      llmDetected: true,
      costCents,
    };
  } catch (err) {
    console.error(`[sector-detector] échec : ${(err as Error).message}`);
    return detectByKeywords(message);
  }
}

/**
 * Construit le bloc "vocabulaire métier + règles" à injecter dans le system
 * prompt de brain.ts pour adapter automatiquement l'agent au secteur du client.
 */
export function buildSectorPromptBlock(sector: SectorId): string {
  const meta = SECTOR_REGISTRY[sector];
  if (!meta || sector === "autre") return "";

  const lines: string[] = [];
  lines.push(`# Contexte secteur : ${meta.name}`);

  if (meta.glossary.length > 0) {
    lines.push("");
    lines.push("## Vocabulaire métier à utiliser naturellement");
    for (const term of meta.glossary) {
      lines.push(`- ${term}`);
    }
  }

  if (meta.rules.length > 0) {
    lines.push("");
    lines.push("## Règles métier critiques pour ce secteur");
    for (const rule of meta.rules) {
      lines.push(`- ${rule}`);
    }
  }

  return lines.join("\n");
}
