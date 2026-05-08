import { SKILL_REGISTRY } from "@/agent/skills/registry";
import { TOOL_REGISTRY } from "@/agent/tools/registry";
import { MODULE_REGISTRY } from "@/modules/registry";
import { getAllInstructions } from "@/lib/db/skill-instructions";
import { SkillsUI } from "./skills-ui";

export default async function SkillsPage() {
  const customInstructions = await getAllInstructions();

  // Map tool ID → tool meta (pour afficher le nom + description)
  const toolById = new Map(TOOL_REGISTRY.map((t) => [t.id, t]));

  // Map tool ID → modules qui l'utilisent
  const modulesByToolId = new Map<string, string[]>();
  for (const m of MODULE_REGISTRY) {
    for (const tid of m.tools) {
      const arr = modulesByToolId.get(tid) ?? [];
      arr.push(m.name);
      modulesByToolId.set(tid, arr);
    }
  }

  // Construire le payload pour le composant client
  const skills = SKILL_REGISTRY.map((s) => {
    const customInst = customInstructions[s.id];
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      emoji: s.emoji,
      category: s.category,
      uiColor: s.uiColor,
      useCases: s.useCases,
      tools: s.toolIds
        .map((tid) => {
          const t = toolById.get(tid);
          if (!t) return null;
          return {
            id: t.id,
            name: t.name,
            description: t.description,
            exposedToLLM: t.exposedToLLM,
            usedByModules: modulesByToolId.get(t.id) ?? [],
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
      // Instruction effective : custom si écrite, sinon défaut du registry
      instructionText: customInst?.text ?? s.defaultInstructions,
      isCustomized: customInst?.customized ?? false,
      defaultInstructions: s.defaultInstructions,
      updatedAt: customInst?.updatedAt ?? null,
    };
  });

  return (
    <div className="p-6">
      <SkillsUI skills={skills} />
    </div>
  );
}
