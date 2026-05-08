import type { DomainTestSuite } from "./types";

export const FINANCE_SUITE: DomainTestSuite = {
  domain: "finance",
  name: "Finance & Marchés",
  emoji: "💹",
  questions: [
    {
      id: "finance-001",
      domain: "finance",
      difficulty: "easy",
      question: "C'est quoi une obligation ?",
      expectedConcepts: ["dette", "emprunt", "coupon", "maturité", "remboursement"],
      expectedKeywords: ["obligation", "dette", "intérêts", "échéance", "coupon"],
      minScore: 8.0,
    },
    {
      id: "finance-002",
      domain: "finance",
      difficulty: "medium",
      question: "Le CAC40 est à 7800, RSI à 72, MACD négatif. Que faire ?",
      expectedConcepts: [
        "surachat",
        "divergence baissière",
        "correction probable",
        "prudence",
      ],
      expectedKeywords: ["RSI", "surachat", "correction", "MACD", "divergence"],
      minScore: 7.0,
    },
    {
      id: "finance-003",
      domain: "finance",
      difficulty: "easy",
      question: "Quelle différence entre ETF et action en direct ?",
      expectedConcepts: ["diversification", "panier", "frais de gestion", "tracker"],
      expectedKeywords: ["ETF", "indice", "panier", "TER", "diversification"],
      minScore: 7.0,
    },
    {
      id: "finance-004",
      domain: "finance",
      difficulty: "hard",
      question:
        "Un PER (Plan Épargne Retraite) versus assurance-vie pour un cadre 40 ans tranche 41% : que conseiller ?",
      expectedConcepts: [
        "déductibilité fiscale",
        "blocage jusqu'à retraite",
        "tranche marginale",
        "transmission",
        "liquidité",
      ],
      expectedKeywords: ["PER", "déduction", "TMI", "assurance-vie", "abattement"],
      minScore: 7.5,
    },
    {
      id: "finance-005",
      domain: "finance",
      difficulty: "medium",
      question: "Mon TMI est 30%. Vaut-il mieux SCPI en direct ou en assurance-vie ?",
      expectedConcepts: [
        "fiscalité revenus fonciers",
        "prélèvements sociaux",
        "enveloppe fiscale",
      ],
      expectedKeywords: ["SCPI", "TMI", "PFL", "assurance-vie", "fiscalité"],
      minScore: 7.0,
    },
  ],
};
