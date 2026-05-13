import { z } from "zod";
import type { ToolDefinition } from "./types";

/**
 * Tools Google Contacts (People API) — lister + créer des contacts.
 */

// ─── READ ────────────────────────────────────────────────

const readInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Filtre par nom/email (ex: 'Marc'). Vide = lister tous."),
  maxResults: z.number().int().min(1).max(100).default(50),
});

export interface ContactSummary {
  resourceName: string;
  displayName?: string;
  emails: string[];
  phones: string[];
}

export interface ReadContactsOutput {
  contacts: ContactSummary[];
}

export const readGoogleContactsTool: ToolDefinition<
  typeof readInputSchema,
  ReadContactsOutput
> = {
  id: "read-google-contacts",
  name: "Lister / chercher contacts Google",
  description:
    "Liste les contacts Google du client ou filtre par nom/email. Utile pour 'envoie un mail à Marc', 'le numéro de Mme Dupond ?', etc.",
  category: "integration",
  exposedToLLM: true,
  costEstimateCents: 0,
  inputSchema: readInputSchema,
  execute: async ({ query, maxResults }, ctx) => {
    const { getAuthedGoogleClient, google } = await import(
      "@/lib/google/authed-client"
    );
    const oauth2 = await getAuthedGoogleClient(
      ctx.clientId,
      "lister tes contacts",
    );
    const people = google.people({ version: "v1", auth: oauth2 });

    // L'API People utilise 2 endpoints distincts : list + searchContacts
    if (query) {
      const res = await people.people.searchContacts({
        query,
        pageSize: maxResults,
        readMask: "names,emailAddresses,phoneNumbers",
      });
      const contacts: ContactSummary[] = (res.data.results ?? []).map((r) => ({
        resourceName: r.person?.resourceName ?? "",
        displayName: r.person?.names?.[0]?.displayName ?? undefined,
        emails: (r.person?.emailAddresses ?? [])
          .map((e) => e.value)
          .filter((v): v is string => Boolean(v)),
        phones: (r.person?.phoneNumbers ?? [])
          .map((p) => p.value)
          .filter((v): v is string => Boolean(v)),
      }));
      ctx.log("info", `read-google-contacts "${query}" → ${contacts.length}`);
      return { contacts };
    }

    const res = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: maxResults,
      personFields: "names,emailAddresses,phoneNumbers",
    });
    const contacts: ContactSummary[] = (res.data.connections ?? []).map((p) => ({
      resourceName: p.resourceName ?? "",
      displayName: p.names?.[0]?.displayName ?? undefined,
      emails: (p.emailAddresses ?? [])
        .map((e) => e.value)
        .filter((v): v is string => Boolean(v)),
      phones: (p.phoneNumbers ?? [])
        .map((p) => p.value)
        .filter((v): v is string => Boolean(v)),
    }));
    ctx.log("info", `read-google-contacts (all) → ${contacts.length}`);
    return { contacts };
  },
};

// ─── CREATE ────────────────────────────────────────────────

const createInputSchema = z.object({
  name: z.string().describe("Nom complet du contact (ex: 'Marc Dupond')"),
  email: z.string().optional().describe("Email du contact"),
  phone: z.string().optional().describe("Téléphone (ex: '+33 6 12 34 56 78')"),
  notes: z.string().optional().describe("Notes additionnelles"),
});

export interface CreateContactOutput {
  ok: boolean;
  resourceName?: string;
  error?: string;
}

export const createGoogleContactTool: ToolDefinition<
  typeof createInputSchema,
  CreateContactOutput
> = {
  id: "create-google-contact",
  name: "Créer un contact Google",
  description:
    "Crée un nouveau contact dans Google Contacts. Utile après un appel/RDV pour ajouter un prospect.",
  category: "integration",
  exposedToLLM: true,
  requiresSupervision: true,
  costEstimateCents: 0,
  inputSchema: createInputSchema,
  execute: async ({ name, email, phone, notes }, ctx) => {
    const { getAuthedGoogleClient, google } = await import(
      "@/lib/google/authed-client"
    );
    const oauth2 = await getAuthedGoogleClient(
      ctx.clientId,
      "créer un contact",
    );
    const people = google.people({ version: "v1", auth: oauth2 });

    try {
      const res = await people.people.createContact({
        requestBody: {
          names: [{ unstructuredName: name }],
          emailAddresses: email ? [{ value: email }] : undefined,
          phoneNumbers: phone ? [{ value: phone }] : undefined,
          biographies: notes
            ? [{ value: notes, contentType: "TEXT_PLAIN" }]
            : undefined,
        },
      });
      ctx.log("info", `create-google-contact OK : ${name}`);
      return { ok: true, resourceName: res.data.resourceName ?? undefined };
    } catch (err) {
      const msg = (err as Error).message;
      ctx.log("error", `create-google-contact échec : ${msg}`);
      return { ok: false, error: msg };
    }
  },
};
