import type { DomainTestSuite } from "./types";

export const COMPTABILITE_SUITE: DomainTestSuite = {
  domain: "comptabilite",
  name: "Comptabilité",
  emoji: "📊",
  questions: [
    {
      id: "compta-001",
      domain: "comptabilite",
      difficulty: "easy",
      question: "Quand faut-il déclarer la TVA en CA3 ?",
      expectedConcepts: ["régime réel normal", "mensuel", "le 19 du mois"],
      expectedKeywords: ["CA3", "TVA", "19", "mensuel", "trimestriel"],
      minScore: 8.0,
    },
    {
      id: "compta-002",
      domain: "comptabilite",
      difficulty: "easy",
      question: "Compte 411 vs compte 401 : c'est quoi ?",
      expectedConcepts: ["clients", "fournisseurs", "créances", "dettes"],
      expectedKeywords: ["411", "401", "clients", "fournisseurs"],
      minScore: 8.0,
    },
    {
      id: "compta-003",
      domain: "comptabilite",
      difficulty: "medium",
      question:
        "Un de mes clients micro-entreprise dépasse 188 700€ de CA en BIC vente. Que se passe-t-il ?",
      expectedConcepts: [
        "perte du régime micro",
        "passage au réel",
        "année N+1 ou suivante",
        "tolérance",
      ],
      expectedKeywords: ["micro", "188700", "BIC", "régime réel", "seuil"],
      minScore: 7.5,
    },
    {
      id: "compta-004",
      domain: "comptabilite",
      difficulty: "medium",
      question:
        "Comment relancer un impayé fournisseur de 4500€ en retard de 45 jours ?",
      expectedConcepts: [
        "mise en demeure",
        "intérêts de retard",
        "indemnité forfaitaire 40€",
        "recouvrement",
      ],
      expectedKeywords: ["mise en demeure", "intérêts", "40 €", "recouvrement", "LRAR"],
      minScore: 7.0,
    },
    {
      id: "compta-005",
      domain: "comptabilite",
      difficulty: "hard",
      question:
        "Mon client SCI à l'IS veut distribuer un dividende de 50k€ à un associé personne physique. Fiscalité ?",
      expectedConcepts: [
        "PFU 30%",
        "option barème IR",
        "abattement 40%",
        "prélèvements sociaux 17.2%",
      ],
      expectedKeywords: ["PFU", "flat tax", "30%", "abattement 40", "barème"],
      minScore: 7.5,
    },
  ],
};
