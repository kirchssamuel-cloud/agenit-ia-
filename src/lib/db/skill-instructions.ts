import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Persistance des instructions custom écrites par l'admin pour chaque
 * compétence. C'est ICI que tu apprends à l'agent comment faire.
 *
 *   skillId → texte d'instructions (markdown)
 *
 * - En local : fichier JSON dans data/skill-instructions.json
 * - Sur Vercel (FS read-only) : globalThis cache (volatile par instance)
 * - À terme : table Supabase skill_instructions (1 ligne par skillId)
 *
 * Même pattern que module-overrides.ts, c'est éprouvé.
 */

export interface SkillInstruction {
  /** Texte écrit par l'admin pour apprendre à l'agent */
  text: string;
  /** True si l'admin a personnalisé (sinon = défaut du registry) */
  customized: boolean;
  updatedAt: string;
}

interface StoreFile {
  /** skillId → instruction */
  byId: Record<string, SkillInstruction>;
  updatedAt: string;
}

const STORE_PATH = path.join(
  process.cwd(),
  "data",
  "skill-instructions.json",
);

const IS_READONLY_FS = process.env.VERCEL === "1";

declare global {
  // eslint-disable-next-line no-var
  var __skillInstructionsMemory: StoreFile | undefined;
}

function getMemoryStore(): StoreFile {
  if (!globalThis.__skillInstructionsMemory) {
    globalThis.__skillInstructionsMemory = {
      byId: {},
      updatedAt: new Date().toISOString(),
    };
  }
  return globalThis.__skillInstructionsMemory;
}

async function readStore(): Promise<StoreFile> {
  if (IS_READONLY_FS) return getMemoryStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as StoreFile;
  } catch {
    return { byId: {}, updatedAt: new Date().toISOString() };
  }
}

async function writeStore(data: StoreFile): Promise<void> {
  if (IS_READONLY_FS) {
    globalThis.__skillInstructionsMemory = data;
    return;
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getInstruction(
  skillId: string,
): Promise<SkillInstruction | null> {
  const store = await readStore();
  return store.byId[skillId] ?? null;
}

export async function getAllInstructions(): Promise<
  Record<string, SkillInstruction>
> {
  const store = await readStore();
  return store.byId;
}

export async function setInstruction(
  skillId: string,
  text: string,
): Promise<SkillInstruction> {
  const store = await readStore();
  const next: SkillInstruction = {
    text,
    customized: text.trim().length > 0,
    updatedAt: new Date().toISOString(),
  };
  store.byId[skillId] = next;
  store.updatedAt = next.updatedAt;
  await writeStore(store);
  return next;
}

export async function clearInstruction(skillId: string): Promise<void> {
  const store = await readStore();
  delete store.byId[skillId];
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
}
