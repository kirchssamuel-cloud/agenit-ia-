import "server-only";
import { listOpenGaps, type AgentGap } from "@/lib/db/test-bank-store";

/**
 * Knowledge Enricher (Phase 4 — auto-amélioration).
 *
 * Pour chaque gap ouvert, propose une correction concrète :
 * - missing_vocab → ajoute le mot-clé au glossary du SkillFolder ou SectorAgent
 * - missing_concept → propose un fragment d'instruction à ajouter dans
 *   /admin/tools (zone "Apprends à l'agent")
 * - wrong_method → suggère un retravail de l'instruction par défaut
 * - tone_mismatch → suggère d'ajuster le ton dans client_context.tone
 *
 * État actuel : SCAFFOLD. La logique de génération de fix sera implémentée
 * en Phase 4. Pour l'instant on expose juste l'API et un draft heuristique
 * pour que le dashboard puisse afficher des "suggestions de fix".
 */

export interface EnrichmentSuggestion {
  gapId: string;
  domain: string;
  /** Texte de correction proposé (à valider par l'admin) */
  proposedFix: string;
  /** Action concrète : où appliquer le fix */
  applyTarget:
    | "skill-instruction" // /admin/tools — zone "Apprends à l'agent"
    | "sector-glossary" // ajouter au vocabulaire métier
    | "client-context" // ajuster context (tone, prefs)
    | "manual"; // intervention manuelle requise
  confidence: number; // 0..1
}

function heuristicFix(gap: AgentGap): EnrichmentSuggestion {
  let proposedFix = "";
  let applyTarget: EnrichmentSuggestion["applyTarget"] = "manual";
  let confidence = 0.4;

  switch (gap.gapType) {
    case "missing_vocab":
      proposedFix = `Ajouter ces mots-clés au vocabulaire métier du secteur ${gap.domain} : ${gap.description.replace("Vocabulaire technique manquant : ", "")}`;
      applyTarget = "sector-glossary";
      confidence = 0.7;
      break;
    case "missing_concept":
      proposedFix = `Ajouter une règle dans /admin/tools (compétence concernée) : "${gap.description.replace("Concepts non couverts : ", "Inclure systématiquement : ")}"`;
      applyTarget = "skill-instruction";
      confidence = 0.6;
      break;
    case "wrong_method":
      proposedFix = `Retravailler l'instruction par défaut de la compétence concernée. Voir l'exemple lié à ce gap pour identifier la dérive.`;
      applyTarget = "skill-instruction";
      confidence = 0.5;
      break;
    case "tone_mismatch":
      proposedFix = `Ajuster le ton dans client_context.tone (formel / chaleureux / technique selon le domaine).`;
      applyTarget = "client-context";
      confidence = 0.5;
      break;
    default:
      proposedFix = `Investigation manuelle nécessaire. ${gap.description}`;
      applyTarget = "manual";
      confidence = 0.3;
  }

  return {
    gapId: gap.id,
    domain: gap.domain,
    proposedFix,
    applyTarget,
    confidence,
  };
}

/**
 * Génère des suggestions de fix pour tous les gaps ouverts.
 * (Phase 4 améliorera : utiliser Claude Opus pour générer des fixes plus précis.)
 */
export async function generateFixSuggestions(
  domain?: string,
): Promise<EnrichmentSuggestion[]> {
  const gaps = await listOpenGaps(domain);
  return gaps.map(heuristicFix);
}
