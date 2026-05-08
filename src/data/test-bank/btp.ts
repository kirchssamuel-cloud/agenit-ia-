import type { DomainTestSuite } from "./types";

export const BTP_SUITE: DomainTestSuite = {
  domain: "btp",
  name: "BTP / Artisanat",
  emoji: "🔨",
  questions: [
    {
      id: "btp-001",
      domain: "btp",
      difficulty: "easy",
      question: "Calcule un devis pour 100m² de carrelage premium fourniture pose comprise. Marge habituelle 30%.",
      expectedConcepts: [
        "prix unitaire au m²",
        "main d'œuvre",
        "matériaux",
        "marge",
        "TVA",
        "total HT/TTC",
      ],
      expectedKeywords: ["m²", "FPC", "TVA", "marge", "HT", "TTC", "acompte"],
      minScore: 7.0,
    },
    {
      id: "btp-002",
      domain: "btp",
      difficulty: "easy",
      question: "C'est quoi la différence entre TVA 10% et TVA 20% en rénovation ?",
      expectedConcepts: [
        "logement >2 ans",
        "amélioration",
        "neuf",
        "construction",
      ],
      expectedKeywords: ["TVA 10%", "TVA 20%", "rénovation", "neuf", "ans"],
      minScore: 8.0,
    },
    {
      id: "btp-003",
      domain: "btp",
      difficulty: "medium",
      question:
        "Un client veut une mise en demeure pour facture impayée depuis 60 jours. Quelle structure ?",
      expectedConcepts: [
        "rappel des faits",
        "montant dû",
        "délai légal",
        "menace recouvrement",
        "LRAR",
      ],
      expectedKeywords: ["mise en demeure", "LRAR", "facture", "délai", "intérêts"],
      minScore: 7.0,
    },
    {
      id: "btp-004",
      domain: "btp",
      difficulty: "hard",
      question:
        "Un chantier de rénovation salle de bain : démolition + plomberie + carrelage + peinture. Comment structurer le devis ?",
      expectedConcepts: [
        "découpage par poste",
        "ordre d'intervention",
        "MO et matériaux séparés",
        "DTU plomberie",
        "garanties",
      ],
      expectedKeywords: ["poste", "DTU", "plomberie", "carrelage", "main d'œuvre", "TVA 10%"],
      minScore: 7.5,
    },
    {
      id: "btp-005",
      domain: "btp",
      difficulty: "medium",
      question: "C'est quoi le label RGE et à quoi ça sert pour mes clients ?",
      expectedConcepts: [
        "Reconnu Garant Environnement",
        "MaPrimeRénov'",
        "éligibilité aides",
      ],
      expectedKeywords: ["RGE", "MaPrimeRénov", "Qualibat", "aides", "éco-PTZ"],
      minScore: 7.5,
    },
  ],
};
