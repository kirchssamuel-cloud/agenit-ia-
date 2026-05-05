import { Search } from "lucide-react";
import { z } from "zod";
import type { ModuleDefinition } from "../types";
import { readIcall26LeadsTool } from "@/agent/tools/read-icall26-leads";
import { readIcall26AppointmentsTool } from "@/agent/tools/read-icall26-appointments";
import { readIcall26SalesPerformanceTool } from "@/agent/tools/read-icall26-sales-performance";

const configSchema = z.object({
  crmTarget: z.enum(["icall26", "hubspot", "pipedrive"]).default("icall26"),
});

export const crmAssistantModule: ModuleDefinition<typeof configSchema> = {
  id: "crm-assistant",
  name: "Assistant CRM (lecture & analyse)",
  shortDescription:
    "Permet à ton agent de répondre aux questions sur ton CRM : leads, RDV, performances commerciales.",
  longDescription:
    "Ton agent peut interroger ton CRM (iCall26 et autres) en langage naturel. Pose-lui des questions comme 'combien de leads cette semaine ?', 'qui convertit le mieux ce mois-ci ?', 'liste les RDV de demain'. Il va chercher l'info et répond.",
  category: "leads",
  icon: Search,
  version: "0.1.0",
  status: "alpha",
  pricing: { monthlyEUR: 79 },
  tools: [
    readIcall26LeadsTool.id,
    readIcall26AppointmentsTool.id,
    readIcall26SalesPerformanceTool.id,
  ],
  triggers: ["manual"],
  configSchema,
  defaultConfig: { crmTarget: "icall26" },
  // Pas de run() : ce module n'a pas de workflow autonome,
  // il sert juste à exposer les tools de lecture à l'agent.
};
