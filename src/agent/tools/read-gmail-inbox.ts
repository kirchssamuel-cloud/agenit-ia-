import { z } from "zod";
import { google } from "googleapis";
import type { ToolDefinition } from "./types";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getOAuthToken, upsertOAuthToken } from "@/lib/db/oauth";

const inputSchema = z.object({
  query: z
    .string()
    .default("newer_than:1d has:attachment")
    .describe("Requête Gmail (syntaxe identique au champ recherche Gmail)."),
  maxResults: z.number().int().min(1).max(50).default(10),
  /** Si true, télécharge le contenu base64 des pièces jointes. */
  includeAttachments: z.boolean().default(true),
});

export interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  /** base64 — uniquement si includeAttachments=true */
  data?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  attachments: GmailAttachment[];
}

export interface ReadGmailOutput {
  messages: GmailMessage[];
  account: string | null;
}

export const readGmailInboxTool: ToolDefinition<typeof inputSchema, ReadGmailOutput> = {
  id: "read-gmail-inbox",
  name: "Lire la boîte Gmail du client",
  description:
    "Liste les messages récents de la boîte Gmail connectée par le client (OAuth) en filtrant par requête. Retourne sujets et pièces jointes.",
  category: "integration",
  exposedToLLM: true,
  inputSchema,
  execute: async ({ query, maxResults, includeAttachments }, ctx) => {
    const tokenRecord = await getOAuthToken(ctx.clientId, "google");
    if (!tokenRecord) {
      throw new Error(
        "Aucun compte Gmail connecté pour ce client. Demande au client de cliquer « Connecter Gmail ».",
      );
    }

    const oauth2 = createGoogleOAuthClient();
    oauth2.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
      expiry_date: tokenRecord.expiresAt
        ? new Date(tokenRecord.expiresAt).getTime()
        : undefined,
      scope: tokenRecord.scope,
      token_type: tokenRecord.tokenType,
    });

    // Auto-refresh si proche expiration
    oauth2.on("tokens", async (newTokens) => {
      try {
        await upsertOAuthToken({
          clientId: ctx.clientId,
          provider: "google",
          accessToken: newTokens.access_token ?? tokenRecord.accessToken,
          refreshToken: newTokens.refresh_token ?? tokenRecord.refreshToken,
          scope: newTokens.scope ?? tokenRecord.scope,
          tokenType: newTokens.token_type ?? tokenRecord.tokenType,
          expiresAt: newTokens.expiry_date
            ? new Date(newTokens.expiry_date)
            : undefined,
          accountEmail: tokenRecord.accountEmail,
        });
        ctx.log("info", "Token Google rafraîchi");
      } catch (err) {
        ctx.log("warn", "Échec stockage du token rafraîchi", {
          error: (err as Error).message,
        });
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    const messages: GmailMessage[] = [];
    for (const m of list.data.messages ?? []) {
      if (!m.id) continue;
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: m.id,
        format: "full",
      });
      const headers = detail.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const attachments: GmailAttachment[] = [];
      const collectParts = (parts?: typeof detail.data.payload) => {
        if (!parts) return;
        const queue = [parts];
        while (queue.length > 0) {
          const p = queue.shift()!;
          if (p.parts) queue.push(...p.parts);
          if (p.filename && p.body?.attachmentId) {
            attachments.push({
              filename: p.filename,
              mimeType: p.mimeType ?? "application/octet-stream",
              size: p.body.size ?? 0,
            });
          }
        }
      };
      collectParts(detail.data.payload ?? undefined);

      if (includeAttachments && attachments.length > 0) {
        for (const att of attachments) {
          // Re-find the part to get the attachmentId
          const findId = (p?: typeof detail.data.payload): string | null => {
            if (!p) return null;
            if (p.filename === att.filename && p.body?.attachmentId) {
              return p.body.attachmentId;
            }
            for (const sub of p.parts ?? []) {
              const r = findId(sub);
              if (r) return r;
            }
            return null;
          };
          const attId = findId(detail.data.payload ?? undefined);
          if (!attId) continue;
          const data = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: m.id,
            id: attId,
          });
          if (data.data.data) {
            // Gmail returns base64url; convert to standard base64
            att.data = data.data.data
              .replace(/-/g, "+")
              .replace(/_/g, "/");
          }
        }
      }

      messages.push({
        id: m.id,
        threadId: m.threadId ?? "",
        subject: get("Subject"),
        from: get("From"),
        date: get("Date"),
        snippet: detail.data.snippet ?? "",
        attachments,
      });
    }

    ctx.log("info", `Gmail : ${messages.length} message(s) lus`, {
      account: tokenRecord.accountEmail,
      query,
    });

    return { messages, account: tokenRecord.accountEmail ?? null };
  },
};
