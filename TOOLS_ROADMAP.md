# Roadmap des Tools — le "cerveau" de l'agent

Chaque tool = une compétence atomique. Plus on en a, plus on peut composer de modules vendables rapidement. On enrichit le cerveau au fil des besoins clients.

**Statut :**
- ✅ implémenté
- 🟡 stub (signature OK, logique à coder)
- ⏳ à créer

---

## Famille 1 — Données (parsing, nettoyage, transformation)

| Tool | Statut | Utilité |
|---|---|---|
| `parse-csv` | ✅ | Lire un CSV (auto-détecte `,` ou `;`) |
| `normalize-phones` | ✅ | Téléphones au format E.164 (+33...) |
| `dedup-rows` | ✅ | Supprimer les doublons |
| `parse-xlsx` | ⏳ | Lire un fichier Excel |
| `parse-json` | ⏳ | Lire un JSON |
| `validate-emails` | ⏳ | Vérifier format + MX record |
| `validate-addresses` | ⏳ | Standardiser une adresse postale |
| `ocr-image` | ⏳ | Lire un ticket de caisse / facture en photo |
| `transform-rows` | ⏳ | Mapper colonnes : "Nom complet" → "prenom" + "nom" |
| `enrich-rows` | ⏳ | Ajouter données externes (LinkedIn, SIREN, etc.) |

---

## Famille 2 — Communication (envoi/réception)

| Tool | Statut | Utilité |
|---|---|---|
| `send-email` | ✅ | Email transactionnel (Resend) |
| `send-whatsapp` | ⏳ | Message WhatsApp (Meta Cloud API) |
| `send-sms` | ⏳ | SMS (Twilio ou OVH) |
| `read-gmail-inbox` | 🟡 | Lire boîte Gmail (OAuth) |
| `read-outlook-inbox` | ⏳ | Lire boîte Outlook (Microsoft Graph) |
| `read-imap-inbox` | ⏳ | Boîte mail générique (OVH, Free, Orange) |
| `send-email-with-template` | ⏳ | Email avec template HTML (relance, rapport) |
| `whatsapp-receive-webhook` | ⏳ | Recevoir messages WA |

---

## Famille 3 — Intégration CRM / Outils métier

| Tool | Statut | Utilité |
|---|---|---|
| `push-icall26` | 🟡 | Pousser leads dans iCall26 (en attente API) |
| `read-icall26-appointments` | ⏳ | Lire RDV pris pour optimisation tournées |
| `push-hubspot` | ⏳ | Idem HubSpot |
| `push-pipedrive` | ⏳ | Idem Pipedrive |
| `read-google-calendar` | ⏳ | Lire / créer événements Google Agenda |
| `read-google-sheets` | ⏳ | Lire / écrire un Google Sheet |
| `read-google-drive` | ⏳ | Lister / télécharger fichiers Drive |
| `pennylane-create-invoice` | ⏳ | Créer facture dans Pennylane (compta FR) |
| `qonto-list-transactions` | ⏳ | Lister transactions Qonto |
| `stripe-create-payment-link` | ⏳ | Lien de paiement Stripe |

---

## Famille 4 — Documents

| Tool | Statut | Utilité |
|---|---|---|
| `generate-invoice-pdf` | ⏳ | Facture PDF avec logo, lignes, TVA |
| `generate-quote-pdf` | ⏳ | Devis PDF (avec marge appliquée) |
| `generate-report-pdf` | ⏳ | Rapport custom (planning, stats) |
| `sign-document` | ⏳ | Signature électronique (Yousign / Docusign) |

---

## Famille 5 — IA (Claude)

| Tool | Statut | Utilité |
|---|---|---|
| `claude-extract` | ⏳ | Extraire données d'un texte libre (devis, mail, ticket) |
| `claude-classify` | ⏳ | Classer un message (spam / lead / SAV / urgent) |
| `claude-summarize` | ⏳ | Résumer un long texte |
| `claude-rewrite` | ⏳ | Réécrire dans le ton souhaité |
| `claude-translate` | ⏳ | Traduire FR ↔ EN ↔ ES ↔ DE |
| `claude-vision` | ⏳ | Analyser une image (ticket, photo, capture) |
| `claude-decide` | ⏳ | "Avec ce contexte, quelle action prendre ?" (orchestration) |

---

## Famille 6 — Géo / Temps

| Tool | Statut | Utilité |
|---|---|---|
| `geocode-address` | ⏳ | Adresse → coordonnées GPS (Google ou Mapbox) |
| `compute-driving-time` | ⏳ | Temps de trajet entre 2 points |
| `optimize-route` | ⏳ | Algo VRP : ordonner N RDV pour minimiser le temps |
| `is-business-hours` | ⏳ | "Est-on dans les horaires ouvrés du client ?" |

---

## Famille 7 — Web

| Tool | Statut | Utilité |
|---|---|---|
| `fetch-url` | ⏳ | Télécharger une page web |
| `scrape-page` | ⏳ | Extraire données d'une page (sélecteurs CSS) |
| `web-search` | ⏳ | Recherche Google (via Serper / Brave) |

---

## Stratégie d'enrichissement

**Règle d'or** : on ne construit un tool que **quand on en a besoin pour un module à vendre**. Sinon on disperse.

**Ordre prévu (par priorité business)** :

### Sprint 1 — Compléter le module "Lead cleaning" (cette semaine)
1. `read-gmail-inbox` (OAuth Google) — pour que l'agent récupère les fichiers tout seul
2. `parse-xlsx` — beaucoup de boîtes envoient des Excel
3. `push-icall26` (vraie implémentation, dès que l'API arrive)

### Sprint 2 — Module "Tour planning" (semaine 2)
1. `read-icall26-appointments`
2. `geocode-address` + `compute-driving-time` + `optimize-route`
3. `send-email-with-template` (envoyer le planning)

### Sprint 3 — Premier module Ziv WhatsApp (semaine 2-3)
1. `whatsapp-receive-webhook` + `send-whatsapp`
2. `claude-classify` + `claude-extract`
3. `claude-decide` (orchestration agentic)

### Sprint 4 — Module facturation/devis (selon demande)
1. `generate-quote-pdf` + `generate-invoice-pdf`
2. `pennylane-create-invoice`
3. `claude-extract` (depuis demande client en texte libre)

---

## Le pattern "tool dans le code"

```ts
// src/agent/tools/<id>.ts
import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  param1: z.string(),
});

export const monNouveauTool: ToolDefinition<typeof inputSchema, MonOutput> = {
  id: "mon-nouveau-tool",
  name: "Nom lisible",
  description: "Ce que ça fait, en clair (visible dans le catalogue admin).",
  category: "data",
  exposedToLLM: true,        // true = Claude peut l'appeler en agent loop
  inputSchema,
  costEstimateCents: 1,       // pour reporting plus tard
  execute: async (input, ctx) => {
    ctx.log("info", "Démarrage", { input });
    // ... logique ...
    return { /* output typé */ };
  },
};
```

Puis l'ajouter dans `src/agent/tools/registry.ts` → il apparaît automatiquement dans `/tools`.
