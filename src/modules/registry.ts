import type { AnyModuleDefinition } from "./types";
import { leadCleaningModule } from "./lead-cleaning";
import { tourPlanningModule } from "./tour-planning";
import { crmAssistantModule } from "./crm-assistant";

export const MODULE_REGISTRY: AnyModuleDefinition[] = [
  leadCleaningModule,
  tourPlanningModule,
  crmAssistantModule,
];

export function getModuleById(id: string): AnyModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

export function getModulesByCategory(): Record<string, AnyModuleDefinition[]> {
  const out: Record<string, AnyModuleDefinition[]> = {};
  for (const m of MODULE_REGISTRY) {
    out[m.category] ??= [];
    out[m.category].push(m);
  }
  return out;
}
