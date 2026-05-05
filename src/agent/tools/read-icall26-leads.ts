import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  status: z
    .enum(["all", "new", "contacted", "qualified", "appointment_set", "lost"])
    .default("all"),
  /** Période en jours (depuis aujourd'hui). 0 = aujourd'hui, 7 = semaine, 30 = mois */
  sinceDays: z.number().int().min(0).max(365).default(7),
  /** Code postal pour filtrer par zone */
  zipPrefix: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(50),
});

export interface Icall26Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  zipCode: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  lastContactAt: string | null;
}

export interface ReadLeadsOutput {
  leads: Icall26Lead[];
  totalMatching: number;
  /** True si on est en mode mock (pas de vraie API) */
  mock: boolean;
}

const SAMPLE_LEADS: Icall26Lead[] = [
  { id: "L-001", name: "Dupont Jean", phone: "+33612345678", email: "j.dupont@example.com", city: "Paris", zipCode: "75019", status: "new", assignedTo: null, createdAt: dayAgo(0), lastContactAt: null },
  { id: "L-002", name: "Martin Sophie", phone: "+33712345678", email: "s.martin@example.com", city: "Lyon", zipCode: "69003", status: "contacted", assignedTo: "Marc", createdAt: dayAgo(1), lastContactAt: dayAgo(0) },
  { id: "L-003", name: "Bernard Lucie", phone: "+33623456789", email: "l.bernard@example.com", city: "Marseille", zipCode: "13008", status: "qualified", assignedTo: "Léa", createdAt: dayAgo(2), lastContactAt: dayAgo(1) },
  { id: "L-004", name: "Garcia Pierre", phone: "+33611223344", email: "p.garcia@example.com", city: "Toulouse", zipCode: "31000", status: "appointment_set", assignedTo: "Marc", createdAt: dayAgo(3), lastContactAt: dayAgo(2) },
  { id: "L-005", name: "Lefevre Claire", phone: "+33698765432", email: "c.lefevre@example.com", city: "Versailles", zipCode: "78000", status: "new", assignedTo: null, createdAt: dayAgo(0), lastContactAt: null },
  { id: "L-006", name: "Petit Marc", phone: "+33655443322", email: "m.petit@example.com", city: "Versailles", zipCode: "78000", status: "contacted", assignedTo: "Léa", createdAt: dayAgo(5), lastContactAt: dayAgo(4) },
  { id: "L-007", name: "Roux Antoine", phone: "+33677889900", email: "a.roux@example.com", city: "Nantes", zipCode: "44000", status: "lost", assignedTo: "Marc", createdAt: dayAgo(10), lastContactAt: dayAgo(8) },
  { id: "L-008", name: "Moreau Julie", phone: "+33688990011", email: "j.moreau@example.com", city: "Bordeaux", zipCode: "33000", status: "qualified", assignedTo: "Marc", createdAt: dayAgo(2), lastContactAt: dayAgo(1) },
  { id: "L-009", name: "Laurent Thomas", phone: "+33699001122", email: "t.laurent@example.com", city: "Paris", zipCode: "75011", status: "new", assignedTo: null, createdAt: dayAgo(0), lastContactAt: null },
  { id: "L-010", name: "Simon Marie", phone: "+33644556677", email: "m.simon@example.com", city: "Lyon", zipCode: "69006", status: "appointment_set", assignedTo: "Léa", createdAt: dayAgo(4), lastContactAt: dayAgo(2) },
];

function dayAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export const readIcall26LeadsTool: ToolDefinition<typeof inputSchema, ReadLeadsOutput> = {
  id: "read-icall26-leads",
  name: "Lire les leads dans iCall26",
  description:
    "Récupère la liste des leads du CRM avec filtres (statut, période, zone). Utilise pour répondre à toute question sur les leads.",
  category: "integration",
  exposedToLLM: true,
  inputSchema,
  execute: async ({ status, sinceDays, zipPrefix, limit }, ctx) => {
    const apiKey = process.env.ICALL26_API_KEY;
    const apiUrl = process.env.ICALL26_API_URL;

    // Mock — tant que l'API n'est pas branchée
    if (!apiKey || !apiUrl) {
      const since = Date.now() - sinceDays * 86_400_000;
      const filtered = SAMPLE_LEADS.filter((l) => {
        if (status !== "all" && l.status !== status) return false;
        if (new Date(l.createdAt).getTime() < since) return false;
        if (zipPrefix && !l.zipCode.startsWith(zipPrefix)) return false;
        return true;
      }).slice(0, limit);
      ctx.log("info", `MOCK iCall26 : ${filtered.length} lead(s) (sur 10 simulés)`);
      return {
        leads: filtered,
        totalMatching: filtered.length,
        mock: true,
      };
    }

    // Mode réel (à brancher dès que la doc API arrive)
    throw new Error(
      "Tool 'read-icall26-leads' non implémenté en mode réel — en attente de la doc API iCall26.",
    );
  },
};
