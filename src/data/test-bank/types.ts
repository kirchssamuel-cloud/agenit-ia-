/**
 * Types pour la banque de tests d'évaluation de l'agent.
 *
 * Chaque domaine (finance, btp, judaisme, ...) exporte un tableau de
 * TestQuestion. Le test runner les charge, les pose à l'agent, et
 * compare la réponse aux concepts/keywords attendus via Claude Opus.
 */

export type TestDifficulty = "easy" | "medium" | "hard";

export interface TestQuestion {
  /** Code court stable (ex: 'finance-001') */
  id: string;
  /** Slug du domaine */
  domain: string;
  difficulty: TestDifficulty;
  /** La question posée à l'agent */
  question: string;
  /** Concepts attendus dans la réponse (sémantique) */
  expectedConcepts: string[];
  /** Mots-clés techniques attendus */
  expectedKeywords: string[];
  /** Score minimum sur 10 pour passer */
  minScore: number;
}

export interface DomainTestSuite {
  /** Slug : 'finance', 'btp', etc. */
  domain: string;
  /** Nom user-facing : 'Finance & Marchés', 'BTP / Artisanat' */
  name: string;
  /** Émoji affiché dans le dashboard */
  emoji: string;
  /** Questions du domaine */
  questions: TestQuestion[];
}
