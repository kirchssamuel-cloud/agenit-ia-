import type { DomainTestSuite } from "./types";

export const COMMERCIAL_SUITE: DomainTestSuite = {
  domain: "commercial",
  name: "Commercial / Vente",
  emoji: "📞",
  questions: [
    {
      id: "commercial-001",
      domain: "commercial",
      difficulty: "easy",
      question: "C'est quoi la différence entre un MQL et un SQL ?",
      expectedConcepts: [
        "Marketing Qualified Lead",
        "Sales Qualified Lead",
        "intention d'achat",
        "scoring",
      ],
      expectedKeywords: ["MQL", "SQL", "qualified", "marketing", "sales"],
      minScore: 7.5,
    },
    {
      id: "commercial-002",
      domain: "commercial",
      difficulty: "medium",
      question:
        "Marc a 5 RDV demain à Paris : 11e, 4e, 19e, 6e, 11e. Comment optimiser sa tournée ?",
      expectedConcepts: [
        "regroupement géographique",
        "minimisation distance",
        "ordre logique",
        "VRP",
        "1h-1h30 max entre RDV",
      ],
      expectedKeywords: ["tournée", "VRP", "Paris", "11e", "ordre"],
      minScore: 7.0,
    },
    {
      id: "commercial-003",
      domain: "commercial",
      difficulty: "medium",
      question:
        "Comment relancer un prospect tiède qui n'a pas répondu depuis 7 jours ?",
      expectedConcepts: [
        "rappel courtois",
        "valeur ajoutée",
        "proposer une action concrète",
        "ne pas être insistant",
      ],
      expectedKeywords: ["relance", "valeur", "RDV", "proposition"],
      minScore: 7.0,
    },
    {
      id: "commercial-004",
      domain: "commercial",
      difficulty: "easy",
      question:
        "Je dois nettoyer une liste de 500 leads CSV. Quelles étapes ?",
      expectedConcepts: [
        "détection doublons",
        "normalisation téléphones E.164",
        "validation emails",
        "marquage suspects",
      ],
      expectedKeywords: ["doublons", "E.164", "+33", "validation", "RGPD"],
      minScore: 7.5,
    },
    {
      id: "commercial-005",
      domain: "commercial",
      difficulty: "hard",
      question:
        "Mon taux de conversion est 8% sur 200 RDV/mois. Comment améliorer ?",
      expectedConcepts: [
        "qualification amont",
        "discours adapté au persona",
        "ICP (Ideal Customer Profile)",
        "objections fréquentes",
        "closing techniques",
      ],
      expectedKeywords: ["conversion", "ICP", "qualification", "objections", "closing"],
      minScore: 7.5,
    },
  ],
};
