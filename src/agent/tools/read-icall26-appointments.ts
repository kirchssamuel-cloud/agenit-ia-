import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  /** Période : 'today' | 'tomorrow' | 'this_week' | 'next_week' */
  period: z
    .enum(["today", "tomorrow", "this_week", "next_week", "this_month"])
    .default("this_week"),
  salesId: z.string().optional().describe("Filtrer par commercial"),
  status: z.enum(["all", "scheduled", "done", "no_show", "cancelled"]).default("all"),
});

export interface Icall26Appointment {
  id: string;
  leadId: string;
  leadName: string;
  address: string;
  scheduledAt: string;
  durationMinutes: number;
  salesId: string;
  salesName: string;
  status: string;
  outcome: string | null;
}

export interface ReadAppointmentsOutput {
  appointments: Icall26Appointment[];
  count: number;
  mock: boolean;
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString();
}

const SAMPLE_APPOINTMENTS: Icall26Appointment[] = [
  { id: "A-001", leadId: "L-004", leadName: "Garcia Pierre", address: "12 rue de Rivoli, 75001 Paris", scheduledAt: hoursFromNow(2), durationMinutes: 60, salesId: "s1", salesName: "Marc", status: "scheduled", outcome: null },
  { id: "A-002", leadId: "L-010", leadName: "Simon Marie", address: "45 cours de la Liberté, 69003 Lyon", scheduledAt: hoursFromNow(5), durationMinutes: 45, salesId: "s2", salesName: "Léa", status: "scheduled", outcome: null },
  { id: "A-003", leadId: "L-008", leadName: "Moreau Julie", address: "8 cours du Médoc, 33300 Bordeaux", scheduledAt: hoursFromNow(28), durationMinutes: 60, salesId: "s1", salesName: "Marc", status: "scheduled", outcome: null },
  { id: "A-004", leadId: "L-003", leadName: "Bernard Lucie", address: "1 place Castellane, 13006 Marseille", scheduledAt: hoursFromNow(-24), durationMinutes: 60, salesId: "s2", salesName: "Léa", status: "done", outcome: "Devis signé, pose prévue" },
  { id: "A-005", leadId: "L-007", leadName: "Roux Antoine", address: "10 rue Crébillon, 44000 Nantes", scheduledAt: hoursFromNow(-72), durationMinutes: 60, salesId: "s1", salesName: "Marc", status: "no_show", outcome: "Client absent, à recontacter" },
  { id: "A-006", leadId: "L-002", leadName: "Martin Sophie", address: "20 avenue Maréchal Foch, 69006 Lyon", scheduledAt: hoursFromNow(48), durationMinutes: 60, salesId: "s2", salesName: "Léa", status: "scheduled", outcome: null },
];

export const readIcall26AppointmentsTool: ToolDefinition<typeof inputSchema, ReadAppointmentsOutput> = {
  id: "read-icall26-appointments",
  name: "Lire les RDV dans iCall26",
  description:
    "Récupère la liste des rendez-vous commerciaux avec filtres (période, commercial, statut). Utilise pour planning, relances, ou bilans de la journée/semaine.",
  category: "integration",
  exposedToLLM: true,
  inputSchema,
  execute: async ({ period, salesId, status }, ctx) => {
    const apiKey = process.env.ICALL26_API_KEY;
    const apiUrl = process.env.ICALL26_API_URL;

    if (!apiKey || !apiUrl) {
      const now = Date.now();
      let from = now;
      let to = now;
      switch (period) {
        case "today":
          from = startOfDay(now);
          to = from + 86_400_000;
          break;
        case "tomorrow":
          from = startOfDay(now) + 86_400_000;
          to = from + 86_400_000;
          break;
        case "this_week":
          from = startOfDay(now) - 7 * 86_400_000;
          to = startOfDay(now) + 7 * 86_400_000;
          break;
        case "next_week":
          from = startOfDay(now) + 7 * 86_400_000;
          to = from + 7 * 86_400_000;
          break;
        case "this_month":
          from = startOfDay(now) - 30 * 86_400_000;
          to = startOfDay(now) + 30 * 86_400_000;
          break;
      }

      const filtered = SAMPLE_APPOINTMENTS.filter((a) => {
        const t = new Date(a.scheduledAt).getTime();
        if (t < from || t > to) return false;
        if (salesId && a.salesId !== salesId) return false;
        if (status !== "all" && a.status !== status) return false;
        return true;
      });
      ctx.log("info", `MOCK iCall26 RDV : ${filtered.length} sur la période ${period}`);
      return { appointments: filtered, count: filtered.length, mock: true };
    }

    throw new Error("Tool 'read-icall26-appointments' non implémenté en mode réel.");
  },
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
