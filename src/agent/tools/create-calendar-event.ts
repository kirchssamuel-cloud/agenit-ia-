import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  summary: z.string().describe("Titre de l'événement (ex: 'RDV Mme Dupond')"),
  start: z
    .string()
    .describe(
      "Date/heure de début. Privilégier ISO 8601 avec offset (ex: '2026-05-20T14:00:00+02:00'). Format local accepté aussi : 'YYYY-MM-DD HH:MM' (interprété en Europe/Paris). NE PAS passer de langage naturel type 'demain 14h' — résoudre la date AVANT.",
    ),
  end: z
    .string()
    .optional()
    .describe(
      "Date/heure de fin (même format que start). Si absent, l'événement dure 1h.",
    ),
  description: z.string().optional().describe("Détails / notes"),
  location: z.string().optional().describe("Lieu (adresse ou visio)"),
  attendees: z
    .array(z.string())
    .optional()
    .describe("Liste d'emails des invités"),
  calendarId: z
    .string()
    .default("primary")
    .describe("ID du calendrier (défaut: 'primary')"),
});

export interface CreateEventOutput {
  ok: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}

/**
 * Convertit l'input en chaîne consommable par Google Calendar.
 *
 * Stratégie pour préserver la timezone Europe/Paris :
 * - ISO complet avec offset/Z (`2026-05-20T14:00:00+02:00`) → tel quel
 * - `YYYY-MM-DD HH:MM[:SS]` (heure locale Paris) → on convertit en
 *   `YYYY-MM-DDTHH:MM:SS` SANS offset → Google interprète selon le
 *   `timeZone: "Europe/Paris"` du body, comportement attendu.
 * - Tout autre format → on tente `new Date()` puis `.toISOString()` (UTC).
 *   En dernier recours uniquement, car perd la timezone locale.
 */
function parseToIso(input: string): string {
  const trimmed = input.trim();
  // ISO complet avec T et offset/Z : on garde tel quel
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return trimmed;
  }
  // Format local "YYYY-MM-DD HH:MM[:SS]" → convertir en datetime local sans offset
  const localMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/,
  );
  if (localMatch) {
    const [, date, time, seconds] = localMatch;
    return `${date}T${time}${seconds ?? ":00"}`;
  }
  // Fallback : Date()
  const d = new Date(trimmed.replace(/\//g, "-"));
  if (isNaN(d.getTime())) {
    throw new Error(
      `Date invalide : "${input}". Format attendu : ISO 8601 (ex: '2026-05-20T14:00:00+02:00') ou 'YYYY-MM-DD HH:MM'.`,
    );
  }
  return d.toISOString();
}

export const createCalendarEventTool: ToolDefinition<
  typeof inputSchema,
  CreateEventOutput
> = {
  id: "create-calendar-event",
  name: "Créer un événement Google Calendar",
  description:
    "Crée un RDV/événement dans le calendrier Google du client. Utilise pour 'note un RDV demain 14h avec X', 'bloque vendredi pour Y'. Envoie automatiquement une invitation aux attendees s'ils sont fournis.",
  category: "integration",
  exposedToLLM: true,
  requiresSupervision: true,
  costEstimateCents: 0,
  inputSchema,
  execute: async (
    { summary, start, end, description, location, attendees, calendarId },
    ctx,
  ) => {
    const { getAuthedGoogleClient, google } = await import(
      "@/lib/google/authed-client"
    );
    const oauth2 = await getAuthedGoogleClient(
      ctx.clientId,
      "créer un événement dans ton calendrier",
    );
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    try {
      const startIso = parseToIso(start);
      let endIso: string;
      if (end) {
        endIso = parseToIso(end);
      } else {
        // Default = +1h. Si startIso est un local datetime sans offset
        // (YYYY-MM-DDTHH:MM:SS), on ajoute 1h en local pour rester cohérent.
        const localMatch = startIso.match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
        );
        if (localMatch) {
          const [, y, mo, d, h, mi, s] = localMatch;
          // Construit en UTC pour additionner proprement, puis re-sérialise sans Z
          const dt = new Date(
            Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) + 3600_000,
          );
          const pad = (n: number) => String(n).padStart(2, "0");
          endIso = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
            dt.getUTCDate(),
          )}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(
            dt.getUTCSeconds(),
          )}`;
        } else {
          endIso = new Date(new Date(startIso).getTime() + 3600_000).toISOString();
        }
      }

      const res = await calendar.events.insert({
        calendarId,
        sendUpdates: attendees && attendees.length > 0 ? "all" : "none",
        requestBody: {
          summary,
          description,
          location,
          start: { dateTime: startIso, timeZone: "Europe/Paris" },
          end: { dateTime: endIso, timeZone: "Europe/Paris" },
          attendees: attendees?.map((email) => ({ email })),
        },
      });

      ctx.log("info", `create-calendar-event OK : ${summary}`, {
        id: res.data.id,
      });
      return {
        ok: true,
        eventId: res.data.id ?? undefined,
        htmlLink: res.data.htmlLink ?? undefined,
      };
    } catch (err) {
      const msg = (err as Error).message;
      ctx.log("error", `create-calendar-event échec : ${msg}`);
      return { ok: false, error: msg };
    }
  },
};
