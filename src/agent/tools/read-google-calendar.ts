import { z } from "zod";
import { google } from "googleapis";
import type { ToolDefinition } from "./types";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getOAuthToken } from "@/lib/db/oauth";

const inputSchema = z.object({
  /** ISO date YYYY-MM-DD ou mot-clé "tomorrow" / "today" / "next-7-days" */
  range: z
    .string()
    .default("tomorrow")
    .describe(
      "Plage : 'today', 'tomorrow', 'next-7-days', ou une date ISO YYYY-MM-DD. Défaut : tomorrow.",
    ),
  calendarId: z
    .string()
    .default("primary")
    .describe("ID du calendrier (défaut: 'primary' = calendrier principal)."),
  maxResults: z.number().int().min(1).max(50).default(20),
});

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime
  end: string;
  attendees: Array<{ email: string; name?: string; response?: string }>;
  conferenceLink?: string;
}

export interface ReadCalendarOutput {
  events: CalendarEvent[];
  range: { from: string; to: string };
  account: string | null;
}

function resolveRange(range: string): { from: Date; to: Date } {
  const now = new Date();
  if (range === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (range === "tomorrow") {
    const from = new Date(now);
    from.setDate(from.getDate() + 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (range === "next-7-days") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { from, to };
  }
  // Date ISO YYYY-MM-DD
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(range);
  if (isoMatch) {
    const from = new Date(`${range}T00:00:00`);
    const to = new Date(`${range}T23:59:59`);
    return { from, to };
  }
  // Fallback : aujourd'hui
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export const readGoogleCalendarTool: ToolDefinition<
  typeof inputSchema,
  ReadCalendarOutput
> = {
  id: "read-google-calendar",
  name: "Lire le calendrier Google du client",
  description:
    "Liste les événements du calendrier Google du client (OAuth) sur une plage donnée. Sers-toi en pour préparer un brief de la journée du lendemain, identifier les RDV à préparer, voir les conflits, etc. Retourne titre, heure, lieu, participants et lien visio si présent.",
  category: "integration",
  exposedToLLM: true,
  costEstimateCents: 0,
  inputSchema,
  execute: async ({ range, calendarId, maxResults }, ctx) => {
    const { getAuthedGoogleClient } = await import("@/lib/google/authed-client");
    const oauth2 = await getAuthedGoogleClient(
      ctx.clientId,
      "lire ton calendrier",
    );

    // Reload token record juste pour récupérer accountEmail pour le return
    const tokenRecord = await getOAuthToken(ctx.clientId, "google");

    const { from, to } = resolveRange(range);

    const calendar = google.calendar({ version: "v3", auth: oauth2 });
    const res = await calendar.events.list({
      calendarId,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events: CalendarEvent[] = (res.data.items ?? []).map((e) => ({
      id: e.id ?? "",
      summary: e.summary ?? "(sans titre)",
      description: e.description ?? undefined,
      location: e.location ?? undefined,
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email ?? "",
        name: a.displayName ?? undefined,
        response: a.responseStatus ?? undefined,
      })),
      conferenceLink:
        e.hangoutLink ??
        e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")
          ?.uri ??
        undefined,
    }));

    ctx.log(
      "info",
      `read-google-calendar ${range} → ${events.length} événements`,
    );

    return {
      events,
      range: { from: from.toISOString(), to: to.toISOString() },
      account: tokenRecord?.accountEmail ?? null,
    };
  },
};
