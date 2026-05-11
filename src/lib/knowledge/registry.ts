import "server-only";
import type { SectorId } from "@/agent/sector-detector";

/**
 * Knowledge base — vocabulaire métier approfondi, méthodes, exemples.
 *
 * Compléte le `glossary`/`rules` léger du sector-detector. Injecté dans le
 * system prompt quand le secteur du client est détecté.
 *
 * Pour ajouter un nouveau domaine : ajouter une entrée ici + créer le
 * SectorId correspondant dans sector-detector.ts si nouveau.
 *
 * Pour étendre un domaine existant : ajouter du vocabulaire / méthodes /
 * exemples. Pas de nouvelle déclaration nécessaire — l'agent le voit
 * automatiquement au prochain appel.
 */

export interface DomainKnowledge {
  /** Vocabulaire technique : terme → définition courte */
  vocabulary: Record<string, string>;
  /** Méthodes de calcul / processus type (pour que l'agent sache COMMENT faire) */
  methods: Record<string, { description: string; steps: string[] }>;
  /** Exemples concrets : situation + raisonnement attendu */
  examples: Array<{
    question: string;
    analysis: string;
    recommendation?: string;
  }>;
}

/**
 * Domaines couverts. Aligné sur les SectorId du sector-detector.
 * Les domaines absents tombent en "autre" → pas de knowledge injectée
 * (l'agent reste compétent grâce à son entraînement Claude générique).
 */
export const KNOWLEDGE_REGISTRY: Partial<Record<SectorId, DomainKnowledge>> = {
  // ============================================================
  // BTP / Artisanat
  // ============================================================
  btp: {
    vocabulary: {
      "m² posé": "Surface réellement carrelée/peinte/posée — facturable. ≠ surface au sol.",
      "Ml": "Mètre linéaire — utilisé pour plinthes, baguettes, listels.",
      "Format 60x60": "Carreau de 60x60cm — standard moderne, économique en pose.",
      "Format 80x80": "Carreau de 80x80cm — premium, moins de joints visibles.",
      "Calepinage": "Plan de pose détaillé montrant l'orientation et le départ des carreaux.",
      "Chape": "Couche de mortier qui aplanit le sol avant pose du carrelage.",
      "Ragréage": "Lissage fin du sol pour rattraper irrégularités <1cm.",
      "Sous-couche": "Couche intermédiaire (isolante, anti-fissure) avant pose finale.",
      "Joint époxy": "Joint résistant chimiquement, utilisé en cuisine/salle de bain pro.",
      "Pose droite": "Pose carreaux alignés en colonne — la plus simple, ~10% de chute.",
      "Pose décalée": "Pose en quinconce comme la brique — ~15% de chute.",
      "Pose diagonale": "Pose à 45° — esthétique, ~20% de chute.",
      "Marge artisan": "Coefficient appliqué aux matériaux + main d'œuvre — typiquement 1.3-1.5x.",
      "MaPrimeRénov'": "Aide État pour travaux de rénovation énergétique éligibles.",
      "TVA 5.5%": "TVA réduite applicable aux travaux d'amélioration énergétique en résidence principale >2 ans.",
      "TVA 10%": "TVA intermédiaire applicable aux travaux d'entretien et amélioration résidence >2 ans.",
      "TVA 20%": "TVA pleine — résidences <2 ans, locaux pro, neuf.",
      "Décennale": "Assurance obligatoire qui couvre 10 ans les défauts de construction.",
      "RGE": "Reconnu Garant Environnement — qualif obligatoire pour aides État.",
      "PV de réception": "Document signé par client validant la fin de chantier — déclenche la garantie.",
    },
    methods: {
      calcul_devis_carrelage: {
        description: "Calculer un devis de pose de carrelage standard",
        steps: [
          "Surface au sol × 1.10 (chute pose droite) = surface à acheter en m²",
          "Prix matériau au m² × surface = coût matériaux HT",
          "Main d'œuvre : 25-45€/m² selon difficulté et région (45+ en Île-de-France)",
          "Sous-total = matériaux + MO",
          "Marge artisan ×1.3 à ×1.5 selon positionnement",
          "TVA selon contexte (5.5% rénovation énergétique, 10% rénovation, 20% neuf)",
          "Inclure plinthes (~10% de la surface en Ml) et accessoires (joints, croisillons)",
        ],
      },
      calcul_surface_avec_chute: {
        description: "Adapter la commande matériaux selon le type de pose",
        steps: [
          "Pose droite : surface × 1.10 (10% chute)",
          "Pose décalée : surface × 1.15 (15% chute)",
          "Pose diagonale : surface × 1.20 (20% chute)",
          "Toujours arrondir au paquet supérieur",
        ],
      },
    },
    examples: [
      {
        question: "Devis pour 50m² carrelage 60x60 premium pose droite",
        analysis:
          "50m² × 1.10 = 55m² à acheter. Carrelage 60x60 premium ~35€/m² → 1925€ matériaux. MO pose droite ~30€/m² × 50 = 1500€. Sous-total 3425€ HT. Avec marge ×1.4 = 4795€ HT. Si rénovation principale >2 ans : TVA 10% → 5275€ TTC.",
        recommendation: "Devis ~5300€ TTC, ajuster selon région et complexité",
      },
      {
        question: "Le client demande si MaPrimeRénov' s'applique à du carrelage",
        analysis:
          "Non — MaPrimeRénov' couvre les travaux d'amélioration énergétique (isolation, chauffage, ventilation). Pose carrelage seule n'est pas éligible. SAUF si associée à isolation au sol (mais c'est l'isolation qui est aidée, pas le carrelage).",
        recommendation: "Rediriger vers les aides régionales si rénovation salle de bain (parfois éligibles)",
      },
    ],
  },

  // ============================================================
  // Commercial (B2B / B2C terrain, prospection, CRM)
  // ============================================================
  commercial: {
    vocabulary: {
      "Lead": "Prospect qualifié — coordonnées + intérêt manifesté.",
      "MQL": "Marketing Qualified Lead — prospect chaud côté marketing, pas encore appelé.",
      "SQL": "Sales Qualified Lead — prospect validé par les ventes, prêt RDV.",
      "Closing": "Étape finale où on signe le contrat.",
      "Pipe / Pipeline": "L'ensemble des prospects à différents stades de la vente.",
      "Cold call": "Appel à froid — prospect qui ne nous attend pas.",
      "Warm call": "Appel à un prospect déjà sensibilisé (campagne, formulaire, ami).",
      "Funnel": "Entonnoir de conversion : visiteurs → leads → prospects → clients.",
      "Taux de conversion": "% de prospects à un stade qui passent au stade suivant.",
      "Taux de closing": "% de RDV qui débouchent sur une vente signée.",
      "ICP": "Ideal Customer Profile — le profil de client idéal pour ton produit.",
      "Persona": "Représentation type d'un segment de clients.",
      "BANT": "Budget, Authority, Need, Timing — critères de qualification d'un lead.",
      "Objection": "Refus ou résistance exprimés par le prospect — à traiter, pas à éviter.",
      "Up-sell": "Vendre une version plus chère/complète à un client existant.",
      "Cross-sell": "Vendre un produit complémentaire à un client existant.",
      "Churn": "Taux de désabonnement / perte de clients.",
      "LTV": "Lifetime Value — valeur totale d'un client sur la durée de la relation.",
      "CAC": "Coût d'acquisition client — total marketing + ventes / nb nouveaux clients.",
      "CRM": "Customer Relationship Management — système de suivi des prospects/clients.",
      "Cycle de vente": "Temps moyen entre 1er contact et signature.",
    },
    methods: {
      qualification_BANT: {
        description: "Qualifier un lead avant de pousser plus loin",
        steps: [
          "Budget : a-t-il les moyens ? Sinon, pas la peine.",
          "Authority : décide-t-il seul ? Sinon, identifier le vrai décideur.",
          "Need : a-t-il un vrai besoin ? Pas juste de la curiosité ?",
          "Timing : c'est pour maintenant ou dans 6 mois ? Adapter la pression commerciale.",
          "Score BANT > 3/4 → SQL. Sinon, nurturing.",
        ],
      },
      traitement_objection: {
        description: "Traiter une objection sans braquer",
        steps: [
          "Écouter complètement (ne pas couper).",
          "Reformuler pour montrer qu'on a compris : 'Si je comprends bien, vous vous demandez si...'",
          "Reconnaître la légitimité : 'Vous avez raison de vous poser la question.'",
          "Répondre avec un fait concret ou une référence client.",
          "Vérifier : 'Ça répond à votre interrogation ?'",
        ],
      },
      brief_avant_rdv: {
        description: "Préparer un brief commercial pertinent avant un RDV terrain",
        steps: [
          "Récupérer l'historique CRM du prospect.",
          "Chercher l'adresse + caractéristiques (immobilier, taille entreprise).",
          "Chercher l'entreprise/personne sur le web (actualité récente, mentions, LinkedIn).",
          "Identifier les concurrents potentiels (autres devis en cours ?).",
          "Préparer 2-3 arguments différenciants ciblés.",
          "Anticiper les 3 objections les plus probables et leurs réponses.",
        ],
      },
    },
    examples: [
      {
        question: "Lead intéressé par panneaux solaires mais dit 'trop cher'",
        analysis:
          "Objection prix classique. Probablement BANT incomplet (Budget). À traiter : 1) Reformuler — vraiment cher, ou cher par rapport à quoi ? 2) Présenter le ROI (économies sur 25 ans, aides MaPrimeRénov' + Prime CEE). 3) Proposer une simulation chiffrée perso. Ne PAS baisser le prix immédiatement — ça décrédibilise.",
        recommendation: "Demander 'combien vous semble raisonnable ?' pour cadrer + faire calculer le payback",
      },
      {
        question: "RDV demain à 14h avec Mme Martin à Aix, 13 rue Pasteur",
        analysis:
          "Brief à préparer : 1) historique iCall26 (qui a appelé, quand, ce qui a été dit). 2) Pavillon ou appart ? Toiture orientée comment (Google Earth) ? Surface ? 3) Météo demain 14h pour timing arrivée. 4) Concurrents probables sur la zone (TotalEnergies, EDF ENR). 5) Aides éligibles : MaPrimeRénov' selon revenus, Prime CEE.",
        recommendation: "Brief complet sur WhatsApp 30 min avant le départ",
      },
    ],
  },

  // ============================================================
  // Comptabilité
  // ============================================================
  comptabilite: {
    vocabulary: {
      "TVA": "Taxe Valeur Ajoutée — collectée sur ventes, déductible sur achats pro.",
      "TVA collectée": "TVA encaissée auprès des clients à reverser à l'État.",
      "TVA déductible": "TVA payée aux fournisseurs, déductible de la TVA collectée.",
      "Crédit de TVA": "Quand TVA déductible > collectée — remboursable par l'État.",
      "Régime réel": "Comptabilité complète, déclaration TVA mensuelle/trimestrielle.",
      "Régime micro": "Régime simplifié pour CA < seuil — pas de TVA, abattement forfaitaire.",
      "Franchise en base": "Pas de TVA collectée tant que CA < 36500€ (services) ou 91900€ (vente).",
      "URSSAF": "Organisme qui collecte cotisations sociales des indépendants.",
      "Bilan": "État du patrimoine de l'entreprise à une date donnée (actif/passif).",
      "Compte de résultat": "Recettes - dépenses sur l'exercice → bénéfice ou perte.",
      "Exercice comptable": "Période de référence (souvent calée sur année civile).",
      "Amortissement": "Étalement du coût d'un investissement sur sa durée de vie.",
      "Provision": "Réserve pour faire face à une dépense future probable.",
      "Charge fixe": "Dépense récurrente quel que soit le CA (loyer, abonnement).",
      "Charge variable": "Dépense proportionnelle à l'activité (matériaux, commissions).",
      "Marge brute": "Prix de vente - coût d'achat direct.",
      "Marge nette": "Bénéfice après toutes charges et impôts.",
      "Rapprochement bancaire": "Vérifier que comptabilité = relevé banque.",
      "FEC": "Fichier des Écritures Comptables — fournir au fisc en cas de contrôle.",
      "DSN": "Déclaration Sociale Nominative — déclaration mensuelle des salaires.",
    },
    methods: {
      calcul_TVA_a_reverser: {
        description: "Calculer la TVA à payer / récupérer sur une période",
        steps: [
          "Total TVA collectée (sur ventes) sur la période.",
          "Total TVA déductible (sur achats pro) sur la période.",
          "TVA collectée - TVA déductible = TVA à reverser.",
          "Si négatif → crédit de TVA, remboursable ou reportable.",
          "Déclaration sur impots.gouv.fr — format CA3 (mensuel) ou CA12 (annuel).",
        ],
      },
      tri_facture: {
        description: "Classer une facture/ticket dans la bonne catégorie comptable",
        steps: [
          "Est-ce une dépense ou une recette ?",
          "Date et montant total TTC.",
          "Montant HT et TVA séparément (clé pour la déduction).",
          "Catégorie : achat marchandise / fourniture / sous-traitance / frais de déplacement / restauration / etc.",
          "Pro à 100% ou usage mixte (alors prorata) ?",
          "Justificatif scanné/photographié — obligatoire pour déduire la TVA.",
        ],
      },
    },
    examples: [
      {
        question: "Je viens de payer 120€ TTC d'essence avec ma carte pro",
        analysis:
          "Essence = frais de déplacement. TVA déductible à 80% (régime fiscal actuel pour gazole, 0% pour essence sauf véhicule utilitaire). 120€ TTC → 100€ HT + 20€ TVA. Si véhicule mixte (perso + pro), prorata d'usage à appliquer (typiquement 50-80%).",
        recommendation: "Saisir : compte 6061 Carburant, justificatif obligatoire, prorata 80% si véhicule pro",
      },
      {
        question: "Je suis en franchise de TVA, dois-je facturer la TVA ?",
        analysis:
          "Non. Tant que tu es sous le seuil (36500€ services / 91900€ vente), tu factures sans TVA. La mention obligatoire sur tes factures : 'TVA non applicable, art. 293 B du CGI'. Tu ne peux PAS récupérer la TVA sur tes achats non plus.",
        recommendation: "Surveiller le seuil — dépassement = sortie de franchise au 1er du mois suivant",
      },
    ],
  },
};

export function getKnowledgeForSector(sector: SectorId | undefined | null): DomainKnowledge | null {
  if (!sector) return null;
  return KNOWLEDGE_REGISTRY[sector] ?? null;
}
