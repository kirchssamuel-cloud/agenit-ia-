# Agent Platform — Console admin

Plateforme d'agence d'agents IA. Console pour gérer les clients et leur attribuer des modules (compétences) que l'agent saura exécuter pour eux.

> Inspiration : "Ziv" (oncle de Samuel), agent multi-compétences avec activation modulaire par client.

---

## Démarrage rapide

```bash
cd C:/Users/eli_k/projects/agent-platform
npm run dev
```

Puis ouvrir <http://localhost:3000>. La home redirige vers `/clients`, qui redirige vers `/login` si non authentifié.

## Configuration

### Variables d'environnement (`.env.local`)

Copier `.env.local.example` vers `.env.local` et remplir les 3 valeurs :

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."  # JAMAIS commité, jamais exposé au client
```

### Créer le compte admin (Samuel)

L'app n'a pas de page de signup public (volontaire). Pour créer ton premier compte :

1. Va dans Supabase Dashboard → **Authentication** → **Users**
2. Clique **"Add user"** → **"Create new user"**
3. Renseigne ton email + un mot de passe fort
4. Coche **"Auto Confirm User"** (sinon il faudra cliquer un mail de validation)
5. Clique **Create user**

Tu peux maintenant te connecter via `/login` avec ces credentials.

### Schéma de base

Le schéma SQL est dans `supabase/schema.sql`. À exécuter une fois dans Supabase → SQL Editor → Run.

---

## Architecture en 3 couches

```
┌─────────────────────────────────────────────────────┐
│  COUCHE 1 — TOOLS (compétences atomiques de l'agent) │
│  src/agent/tools/                                    │
│  Ex: parse-csv, send-email, read-gmail-inbox...      │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  COUCHE 2 — MODULES (recettes vendues aux clients)   │
│  src/modules/                                        │
│  Ex: lead-cleaning = parse-csv + normalize + push    │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  COUCHE 3 — CLIENTS (qui paie pour quels modules)    │
│  Console admin /clients                              │
└─────────────────────────────────────────────────────┘
```

**Règle clé** : un nouveau module ne réinvente rien. Il combine des tools existants. Plus on a de tools, plus on construit des modules vite.

→ Liste complète des tools à construire : [TOOLS_ROADMAP.md](./TOOLS_ROADMAP.md)

## Structure du projet

```
src/
├── app/
│   ├── (admin)/                  # Console admin
│   │   ├── clients/              # Gestion clients + activation modules
│   │   ├── modules/              # Catalogue des modules vendus
│   │   ├── tools/                # Catalogue des compétences atomiques
│   │   └── playground/           # Tester un module pour un client
│   └── layout.tsx
├── agent/
│   ├── tools/                    # Compétences atomiques
│   │   ├── types.ts              # ToolDefinition
│   │   ├── registry.ts           # Liste de tous les tools
│   │   ├── parse-csv.ts          ✅
│   │   ├── normalize-phones.ts   ✅
│   │   ├── dedup-rows.ts         ✅
│   │   ├── send-email.ts         ✅
│   │   ├── read-gmail-inbox.ts   🟡 stub
│   │   └── push-icall26.ts       🟡 stub
│   └── runner.ts                 # Exécute un module pour un client
├── components/
│   ├── admin/sidebar.tsx
│   └── ui/                       # shadcn/ui
├── lib/
│   ├── db/store.ts               # Store en mémoire (Supabase à venir)
│   └── supabase/                 # Clients Supabase (prêts, pas branchés)
└── modules/
    ├── types.ts                  # ModuleDefinition étendu (tools + run + triggers)
    ├── registry.ts
    ├── lead-cleaning/index.ts    ✅ pipeline complet
    └── tour-planning/index.ts    🟡 stub (pas encore implémenté)
```

---

## Comment ajouter un nouveau module (le pattern clé)

1. Créer un dossier `src/modules/<id-du-module>/`
2. Créer `index.ts` avec un export d'objet `ModuleDefinition` :

```ts
import { Wrench } from "lucide-react";
import { z } from "zod";
import type { ModuleDefinition } from "../types";

const configSchema = z.object({
  someSetting: z.string().default(""),
});

export const monNouveauModule: ModuleDefinition<typeof configSchema> = {
  id: "mon-nouveau-module",
  name: "Mon nouveau module",
  shortDescription: "Phrase courte affichée dans la liste.",
  longDescription: "Description longue dans le catalogue.",
  category: "other",
  icon: Wrench,
  version: "0.1.0",
  status: "alpha",
  pricing: { monthlyEUR: 29 },
  configSchema,
  defaultConfig: { someSetting: "" },
};
```

3. L'importer dans `src/modules/registry.ts` et l'ajouter au tableau `MODULE_REGISTRY`.
4. **C'est tout.** Le module apparaît automatiquement :
   - Dans le catalogue (`/modules`)
   - Dans la fiche de chaque client (`/clients/[id]`) avec un switch d'activation

---

## État actuel

- ✅ Console admin (clients + modules)
- ✅ Système de modules déclaratifs auto-enregistrés
- ✅ Création / suppression de clients
- ✅ Activation / désactivation des modules par client
- ⚠️ **Données en mémoire** : tout est perdu au redémarrage du serveur. À brancher sur Supabase (étape suivante).
- ⏳ Pas d'authentification (à ajouter avant déploiement)
- ⏳ Pas d'exécution réelle des modules (juste la config + l'attribution)

---

## Roadmap

### Étape 2 (prochaine session)
- Brancher Supabase (auth admin + tables `clients`, `client_modules`)
- Form d'édition de la config par module/client
- Connecter l'API iCall26 (dès que Samuel l'a)

### Étape 3
- Implémenter le **module `lead-cleaning`** réellement :
  - Webhook reception fichier (mail/upload)
  - Parsing CSV/XLSX + normalisation
  - Push vers iCall26 via API
- Logs d'exécution par client

### Étape 4
- Implémenter le **module `tour-planning`** :
  - Pull des RDV iCall26
  - Géocodage + Google Routes API (VRP)
  - Notification commerciaux (mail ou WhatsApp)
- Dashboard client (vue manager)

### Étape 5
- Déploiement Vercel + Supabase prod
- Page de connexion + signup pour les premiers clients pilotes

---

## Stack

- Next.js 16 (App Router, Server Actions)
- TypeScript
- Tailwind CSS v4 + shadcn/ui (preset Nova)
- Sonner (toasts)
- Zod (validation config modules)
- Supabase (DB + Auth — à brancher)
- Lucide (icônes)
