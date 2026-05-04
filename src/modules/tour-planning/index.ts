import { Map } from "lucide-react";
import { z } from "zod";
import type { ModuleDefinition } from "../types";

const configSchema = z.object({
  maxDriveMinutesBetweenAppointments: z.number().int().min(15).max(240).default(90),
  workingHoursStart: z.string().default("09:00"),
  workingHoursEnd: z.string().default("19:00"),
  routingProvider: z.enum(["google", "mapbox"]).default("google"),
  notifySalesByWhatsApp: z.boolean().default(false),
});

export const tourPlanningModule: ModuleDefinition<typeof configSchema> = {
  id: "tour-planning",
  name: "Optimisation tournées commerciaux",
  shortDescription:
    "Construit chaque soir le planning optimal des commerciaux terrain selon leurs RDV.",
  longDescription:
    "Récupère les RDV pris dans la journée depuis le CRM, géocode les adresses, calcule les tournées optimales pour chaque commercial avec contrainte de temps de trajet maximum entre 2 RDV, et envoie le planning à chacun.",
  category: "scheduling",
  icon: Map,
  version: "0.2.0",
  status: "alpha",
  pricing: { monthlyEUR: 79 },
  tools: ["send-email"],
  triggers: ["cron", "manual"],
  configSchema,
  defaultConfig: {
    maxDriveMinutesBetweenAppointments: 90,
    workingHoursStart: "09:00",
    workingHoursEnd: "19:00",
    routingProvider: "google",
    notifySalesByWhatsApp: false,
  },
  async run() {
    return {
      ok: false,
      summary: "Module tour-planning — implémentation en attente (cron iCall26 + Google Routes API).",
      error: "not implemented",
    };
  },
};
