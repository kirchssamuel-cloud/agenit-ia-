import type { DomainTestSuite } from "./types";

export const JUDAISME_SUITE: DomainTestSuite = {
  domain: "judaisme",
  name: "Judaïsme / Torah",
  emoji: "✡️",
  questions: [
    {
      id: "judaisme-001",
      domain: "judaisme",
      difficulty: "easy",
      question: "C'est quoi la Paracha Berechit ?",
      expectedConcepts: [
        "première Paracha",
        "création du monde",
        "Adam et Ève",
        "Genèse",
        "7 jours",
      ],
      expectedKeywords: ["Berechit", "Genèse", "création", "Adam", "Chabbat"],
      minScore: 7.5,
    },
    {
      id: "judaisme-002",
      domain: "judaisme",
      difficulty: "medium",
      question: "Prépare-moi un discours de 5 minutes sur Paracha Lekh Lekha.",
      expectedConcepts: [
        "Avraham",
        "départ de Haran",
        "promesse divine",
        "lekh lekha (va vers toi)",
        "interprétation kabbalistique ou rationaliste",
      ],
      expectedKeywords: ["Avraham", "Lekh Lekha", "Haran", "alliance", "Israël"],
      minScore: 7.5,
    },
    {
      id: "judaisme-003",
      domain: "judaisme",
      difficulty: "easy",
      question: "Quelle est la différence entre Torah écrite et Torah orale ?",
      expectedConcepts: [
        "5 livres Pentateuque",
        "Talmud",
        "Michna",
        "transmission Sinaï",
      ],
      expectedKeywords: ["Torah", "Talmud", "Michna", "Guemara", "Pentateuque"],
      minScore: 8.0,
    },
    {
      id: "judaisme-004",
      domain: "judaisme",
      difficulty: "medium",
      question: "Quelles sont les 4 espèces de Souccot et leur signification ?",
      expectedConcepts: [
        "Loulav (palmier)",
        "Etrog (cédrat)",
        "Hadassim (myrte)",
        "Aravot (saule)",
        "unité du peuple",
      ],
      expectedKeywords: ["Loulav", "Etrog", "Hadassim", "Aravot", "Souccot"],
      minScore: 8.0,
    },
    {
      id: "judaisme-005",
      domain: "judaisme",
      difficulty: "hard",
      question:
        "Comment expliquer la notion de Tsimtsoum dans la Kabbale lourianique ?",
      expectedConcepts: [
        "contraction divine",
        "Ein Sof",
        "création de l'espace",
        "Isaac Louria",
        "kabbale",
      ],
      expectedKeywords: ["Tsimtsoum", "Ein Sof", "Louria", "kabbale", "contraction"],
      minScore: 7.0,
    },
  ],
};
