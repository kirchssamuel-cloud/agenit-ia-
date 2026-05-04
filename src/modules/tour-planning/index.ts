import { Map } from "lucide-react";
import { z } from "zod";
import type { ModuleDefinition, ModuleRunResult } from "../types";
import { optimizeRouteTool } from "@/agent/tools/optimize-route";
import { sendEmailTool } from "@/agent/tools/send-email";

const configSchema = z.object({
  maxDriveMinutesBetweenAppointments: z.number().int().min(15).max(240).default(90),
  workingHoursStart: z.string().default("09:00"),
  workingHoursEnd: z.string().default("19:00"),
  averageSpeedKmh: z.number().int().min(20).max(120).default(50),
  routingProvider: z.enum(["mock", "google", "mapbox"]).default("mock"),
  notifySalesByEmail: z.boolean().default(false),
  managerEmail: z.string().email().optional(),
});

type Config = z.infer<typeof configSchema>;

interface AppointmentInput {
  id: string;
  address: string;
  durationMinutes?: number;
  preferredStart?: string;
  assignedToSalesId?: string;
  lat?: number;
  lng?: number;
}

interface SalesInput {
  id: string;
  name: string;
  homeAddress?: string;
  email?: string;
}

interface Payload {
  appointments: AppointmentInput[];
  sales: SalesInput[];
}

export const tourPlanningModule: ModuleDefinition<typeof configSchema> = {
  id: "tour-planning",
  name: "Optimisation tournées commerciaux",
  shortDescription:
    "Construit chaque soir le planning optimal des commerciaux terrain selon leurs RDV.",
  longDescription:
    "Récupère les RDV pris dans la journée, géocode les adresses, calcule les tournées optimales pour chaque commercial avec contrainte de temps de trajet maximum entre 2 RDV. Notifie chaque commercial par email du lendemain.",
  category: "scheduling",
  icon: Map,
  version: "0.3.0",
  status: "alpha",
  pricing: { monthlyEUR: 79 },
  tools: [optimizeRouteTool.id, sendEmailTool.id],
  triggers: ["cron", "manual"],
  configSchema,
  defaultConfig: {
    maxDriveMinutesBetweenAppointments: 90,
    workingHoursStart: "09:00",
    workingHoursEnd: "19:00",
    averageSpeedKmh: 50,
    routingProvider: "mock",
    notifySalesByEmail: false,
  },
  async run(ctx): Promise<ModuleRunResult> {
    const config = ctx.config as Config;
    const payload = ctx.payload as Payload;

    if (!payload?.appointments?.length) {
      return {
        ok: false,
        summary: "Aucun RDV fourni",
        error: "missing appointments",
      };
    }
    if (!payload?.sales?.length) {
      return {
        ok: false,
        summary: "Aucun commercial fourni",
        error: "missing sales",
      };
    }

    const result = await optimizeRouteTool.execute(
      {
        appointments: payload.appointments.map((a) => ({
          id: a.id,
          address: a.address,
          durationMinutes: a.durationMinutes ?? 60,
          preferredStart: a.preferredStart,
          assignedToSalesId: a.assignedToSalesId,
          lat: a.lat,
          lng: a.lng,
        })),
        sales: payload.sales.map((s) => ({
          id: s.id,
          name: s.name,
          homeAddress: s.homeAddress,
        })),
        workingHoursStart: config.workingHoursStart,
        maxDriveMinutesBetween: config.maxDriveMinutesBetweenAppointments,
        averageSpeedKmh: config.averageSpeedKmh,
      },
      ctx,
    );

    // Notifications email (optionnel)
    if (config.notifySalesByEmail) {
      for (const route of result.routes) {
        const sales = payload.sales.find((s) => s.id === route.salesId);
        if (!sales?.email) continue;
        const lines = route.steps.map(
          (s, i) =>
            `${i + 1}. ${s.startTime}–${s.endTime}  ${s.address}  (trajet ${s.driveMinutesFromPrev} min)`,
        );
        await sendEmailTool.execute(
          {
            to: sales.email,
            subject: `[Agent] Ton planning de demain (${route.steps.length} RDV)`,
            text: `Bonjour ${sales.name},\n\nVoici ta tournée optimisée :\n\n${lines.join("\n")}\n\nTotal trajet : ${route.totalDriveMinutes} min.\n\nBonne journée !`,
          },
          ctx,
        );
      }
    }

    if (config.managerEmail) {
      const totalSteps = result.routes.reduce((s, r) => s + r.steps.length, 0);
      await sendEmailTool.execute(
        {
          to: config.managerEmail,
          subject: `[Agent] Plannings du jour : ${totalSteps} RDV répartis`,
          text: `${result.routes.length} commerciaux, ${totalSteps} RDV planifiés, ${result.unassignedAppointmentIds.length} non affectés.\n\n${result.warnings.length > 0 ? `Avertissements :\n${result.warnings.join("\n")}` : ""}`,
        },
        ctx,
      );
    }

    const totalSteps = result.routes.reduce((s, r) => s + r.steps.length, 0);
    return {
      ok: true,
      summary: `${result.routes.length} commerciaux, ${totalSteps} RDV planifiés${result.unassignedAppointmentIds.length > 0 ? `, ${result.unassignedAppointmentIds.length} non affectés` : ""}`,
      data: {
        routes: result.routes,
        unassigned: result.unassignedAppointmentIds,
        warnings: result.warnings,
      },
    };
  },
};
