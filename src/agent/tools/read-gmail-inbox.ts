import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  /** Tokens OAuth Google du client (à brancher : table client_oauth_tokens) */
  query: z
    .string()
    .default("newer_than:1d has:attachment")
    .describe("Requête Gmail (syntaxe identique au champ recherche Gmail)."),
  maxResults: z.number().int().min(1).max(50).default(10),
});

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  attachments: { filename: string; mimeType: string; data: string /* base64 */ }[];
}

export interface ReadGmailOutput {
  messages: GmailMessage[];
}

export const readGmailInboxTool: ToolDefinition<typeof inputSchema, ReadGmailOutput> = {
  id: "read-gmail-inbox",
  name: "Lire la boîte Gmail du client",
  description:
    "Liste les messages récents de la boîte Gmail connectée par le client (OAuth) en filtrant par requête. Retourne sujets et pièces jointes.",
  category: "integration",
  exposedToLLM: true,
  inputSchema,
  execute: async (_input, ctx) => {
    ctx.log("warn", "read-gmail-inbox : pas encore implémenté (OAuth Google à brancher).");
    throw new Error(
      "Tool 'read-gmail-inbox' not implemented yet. À implémenter : OAuth Google + Gmail API.",
    );
  },
};
