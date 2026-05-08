import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MODULE_REGISTRY } from "@/modules/registry";

/**
 * Overrides admin pour les modules : prix custom + toggle activer/désactiver.
 * Persistance JSON locale (suffisant pour la démo, à remplacer par Supabase plus tard).
 *
 * Source de vérité finale = MODULE_REGISTRY (code) + overrides (admin runtime).
 */

export interface ModuleOverride {
  /** Prix mensuel en € que l'admin a fixé. Si undefined, on utilise le prix par défaut du registry. */
  monthlyEUR?: number;
  /** Le module est-il visible côté client ? Si false, il n'apparaît pas dans /choose-modules. */
  enabled: boolean;
}

export interface ModuleView {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  status: string;
  defaultMonthlyEUR: number;
  /** Prix effectif (override si défini, sinon prix du registry) */
  monthlyEUR: number;
  /** True si admin a personnalisé le prix */
  hasCustomPrice: boolean;
  /** Visible côté client ? */
  enabled: boolean;
  iconName?: string;
}

const STORE_PATH = path.join(process.cwd(), "data", "module-overrides.json");

interface StoreFile {
  overrides: Record<string, ModuleOverride>;
  updatedAt: string;
}

/**
 * Sur Vercel le filesystem est en lecture seule → on bascule en mémoire.
 * En local (dev), on persiste dans data/module-overrides.json.
 */
const IS_READONLY_FS = process.env.VERCEL === "1";

declare global {
  // eslint-disable-next-line no-var
  var __moduleOverridesMemory: StoreFile | undefined;
}

function getMemoryStore(): StoreFile {
  if (!globalThis.__moduleOverridesMemory) {
    globalThis.__moduleOverridesMemory = {
      overrides: {},
      updatedAt: new Date().toISOString(),
    };
  }
  return globalThis.__moduleOverridesMemory;
}

async function readStore(): Promise<StoreFile> {
  if (IS_READONLY_FS) return getMemoryStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as StoreFile;
  } catch {
    return { overrides: {}, updatedAt: new Date().toISOString() };
  }
}

async function writeStore(data: StoreFile): Promise<void> {
  if (IS_READONLY_FS) {
    globalThis.__moduleOverridesMemory = data;
    return;
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/** Charge les overrides depuis le disque. */
export async function getOverrides(): Promise<Record<string, ModuleOverride>> {
  const store = await readStore();
  return store.overrides;
}

/** Met à jour l'override d'un module (prix + enabled). */
export async function setOverride(
  moduleId: string,
  patch: Partial<ModuleOverride>,
): Promise<ModuleOverride> {
  const store = await readStore();
  const current: ModuleOverride = store.overrides[moduleId] ?? { enabled: true };
  const next: ModuleOverride = {
    enabled: patch.enabled ?? current.enabled,
    monthlyEUR:
      patch.monthlyEUR === undefined ? current.monthlyEUR : patch.monthlyEUR,
  };
  store.overrides[moduleId] = next;
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
  return next;
}

/** Reset l'override d'un module (revient aux valeurs par défaut du registry). */
export async function clearOverride(moduleId: string): Promise<void> {
  const store = await readStore();
  delete store.overrides[moduleId];
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
}

/**
 * Vue fusionnée registry + overrides, prête à passer aux Server Components.
 * @param onlyEnabled si true, filtre les modules désactivés (pour la vue client).
 */
export async function listModuleViews(
  options?: { onlyEnabled?: boolean },
): Promise<ModuleView[]> {
  const overrides = await getOverrides();
  const views = MODULE_REGISTRY.map<ModuleView>((m) => {
    const ovr = overrides[m.id];
    const defaultPrice = m.pricing?.monthlyEUR ?? 0;
    const customPrice = ovr?.monthlyEUR;
    const enabled = ovr?.enabled ?? true;
    return {
      id: m.id,
      name: m.name,
      shortDescription: m.shortDescription,
      longDescription: m.longDescription ?? "",
      category: m.category,
      status: m.status,
      defaultMonthlyEUR: defaultPrice,
      monthlyEUR: customPrice ?? defaultPrice,
      hasCustomPrice: customPrice !== undefined,
      enabled,
    };
  });
  return options?.onlyEnabled ? views.filter((v) => v.enabled) : views;
}
