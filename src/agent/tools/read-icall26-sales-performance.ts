import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  period: z.enum(["today", "this_week", "this_month", "last_30_days"]).default("this_week"),
  salesId: z.string().optional(),
});

export interface SalesPerformance {
  salesId: string;
  salesName: string;
  leadsAssigned: number;
  appointmentsBooked: number;
  appointmentsDone: number;
  appointmentsNoShow: number;
  conversionRate: number; // appointmentsDone / leadsAssigned
  totalRevenueEUR: number;
  avgDealSizeEUR: number;
}

export interface ReadSalesPerformanceOutput {
  period: string;
  performance: SalesPerformance[];
  /** Performance globale agrégée */
  team: {
    leadsAssigned: number;
    appointmentsBooked: number;
    appointmentsDone: number;
    conversionRate: number;
    totalRevenueEUR: number;
  };
  mock: boolean;
}

const SAMPLE_PERF: SalesPerformance[] = [
  {
    salesId: "s1",
    salesName: "Marc",
    leadsAssigned: 47,
    appointmentsBooked: 19,
    appointmentsDone: 12,
    appointmentsNoShow: 4,
    conversionRate: 0.255,
    totalRevenueEUR: 84_000,
    avgDealSizeEUR: 7_000,
  },
  {
    salesId: "s2",
    salesName: "Léa",
    leadsAssigned: 41,
    appointmentsBooked: 23,
    appointmentsDone: 17,
    appointmentsNoShow: 2,
    conversionRate: 0.415,
    totalRevenueEUR: 119_000,
    avgDealSizeEUR: 7_000,
  },
  {
    salesId: "s3",
    salesName: "Thomas",
    leadsAssigned: 38,
    appointmentsBooked: 8,
    appointmentsDone: 5,
    appointmentsNoShow: 2,
    conversionRate: 0.131,
    totalRevenueEUR: 35_000,
    avgDealSizeEUR: 7_000,
  },
];

export const readIcall26SalesPerformanceTool: ToolDefinition<typeof inputSchema, ReadSalesPerformanceOutput> = {
  id: "read-icall26-sales-performance",
  name: "Lire les performances commerciales dans iCall26",
  description:
    "Récupère les KPIs commerciaux : leads attribués, RDV pris, RDV faits, taux de conversion, CA généré. Utile pour tout reporting de performance ou détection de sous-performance.",
  category: "integration",
  exposedToLLM: true,
  inputSchema,
  execute: async ({ period, salesId }, ctx) => {
    const apiKey = process.env.ICALL26_API_KEY;
    const apiUrl = process.env.ICALL26_API_URL;

    if (!apiKey || !apiUrl) {
      const filtered = salesId
        ? SAMPLE_PERF.filter((p) => p.salesId === salesId)
        : SAMPLE_PERF;
      const team = filtered.reduce(
        (acc, p) => ({
          leadsAssigned: acc.leadsAssigned + p.leadsAssigned,
          appointmentsBooked: acc.appointmentsBooked + p.appointmentsBooked,
          appointmentsDone: acc.appointmentsDone + p.appointmentsDone,
          conversionRate: 0, // recalculé après
          totalRevenueEUR: acc.totalRevenueEUR + p.totalRevenueEUR,
        }),
        {
          leadsAssigned: 0,
          appointmentsBooked: 0,
          appointmentsDone: 0,
          conversionRate: 0,
          totalRevenueEUR: 0,
        },
      );
      team.conversionRate =
        team.leadsAssigned > 0
          ? team.appointmentsDone / team.leadsAssigned
          : 0;
      ctx.log("info", `MOCK iCall26 perf : ${filtered.length} commerciaux, période ${period}`);
      return { period, performance: filtered, team, mock: true };
    }

    throw new Error("Tool 'read-icall26-sales-performance' non implémenté en mode réel.");
  },
};
