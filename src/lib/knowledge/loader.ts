import "server-only";
import type { SectorId } from "@/agent/sector-detector";
import { getKnowledgeForSector, type DomainKnowledge } from "./registry";

/**
 * Loader knowledge base — utilisé par brain.ts pour enrichir le system prompt.
 *
 * Garde un cache léger en mémoire process (= revalidé à chaque cold start
 * Vercel, soit ~chaque 15 min pour une fonction inactive). Pas critique car
 * la data est dans le bundle (pas d'IO réseau).
 */

const promptCache = new Map<SectorId, string>();

/**
 * Construit le bloc de connaissance à injecter dans le system prompt.
 * Retourne une chaîne vide si le secteur n'est pas couvert (l'agent reste
 * compétent via son entraînement Claude générique).
 */
export function buildKnowledgePromptForSector(
  sector: SectorId | undefined | null,
): string {
  if (!sector) return "";
  const cached = promptCache.get(sector);
  if (cached !== undefined) return cached;

  const knowledge = getKnowledgeForSector(sector);
  if (!knowledge) {
    promptCache.set(sector, "");
    return "";
  }

  const prompt = formatKnowledge(knowledge, sector);
  promptCache.set(sector, prompt);
  return prompt;
}

function formatKnowledge(k: DomainKnowledge, sector: SectorId): string {
  const lines: string[] = [];

  lines.push(`# Expertise sectorielle approfondie — ${sector}`);
  lines.push("");
  lines.push(
    "Voici le vocabulaire, les méthodes et les exemples typiques de ce métier. Utilise ce savoir quand c'est pertinent — sans le citer comme un manuel. Tu dois sonner comme un pro du secteur, pas comme quelqu'un qui lit une définition.",
  );

  // Vocabulaire
  if (Object.keys(k.vocabulary).length > 0) {
    lines.push("");
    lines.push("## Vocabulaire technique");
    for (const [term, def] of Object.entries(k.vocabulary)) {
      lines.push(`- **${term}** : ${def}`);
    }
  }

  // Méthodes
  if (Object.keys(k.methods).length > 0) {
    lines.push("");
    lines.push("## Méthodes et processus types");
    for (const [name, method] of Object.entries(k.methods)) {
      lines.push("");
      lines.push(`### ${name}`);
      lines.push(method.description);
      lines.push("Étapes :");
      method.steps.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
    }
  }

  // Exemples
  if (k.examples.length > 0) {
    lines.push("");
    lines.push("## Exemples concrets (situation → raisonnement attendu)");
    k.examples.forEach((ex, i) => {
      lines.push("");
      lines.push(`**Exemple ${i + 1}** — *${ex.question}*`);
      lines.push(`Raisonnement : ${ex.analysis}`);
      if (ex.recommendation) {
        lines.push(`Reco : ${ex.recommendation}`);
      }
    });
  }

  return lines.join("\n");
}
