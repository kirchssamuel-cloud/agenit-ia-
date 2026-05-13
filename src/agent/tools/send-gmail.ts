import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  to: z.string().describe("Email destinataire (ex: ami@example.com)"),
  subject: z.string().describe("Sujet de l'email"),
  body: z.string().describe("Corps du message en texte brut"),
  cc: z.string().optional().describe("Email(s) en copie, séparés par virgule"),
  bcc: z.string().optional().describe("Email(s) en copie cachée"),
});

export interface SendGmailOutput {
  ok: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

/**
 * Envoie un email depuis le VRAI compte Gmail du client (pas depuis
 * onboarding@resend.dev qui est un domaine de test). L'email apparaît
 * comme envoyé depuis l'adresse Google de l'utilisateur.
 *
 * Requiert le scope gmail.send (inclus dans FULL_GOOGLE_SCOPES).
 */
export const sendGmailTool: ToolDefinition<typeof inputSchema, SendGmailOutput> = {
  id: "send-gmail",
  name: "Envoyer un email depuis Gmail",
  description:
    "Envoie un email depuis le compte Gmail du client (pas un service tiers). Utilise quand l'user dit 'envoie un mail à...'. L'email apparaît comme venant de son adresse perso/pro, pas d'un domaine bizarre.",
  category: "communication",
  exposedToLLM: true,
  requiresSupervision: true,
  costEstimateCents: 0,
  inputSchema,
  execute: async ({ to, subject, body, cc, bcc }, ctx) => {
    const { getAuthedGoogleClient, google } = await import(
      "@/lib/google/authed-client"
    );
    const oauth2 = await getAuthedGoogleClient(ctx.clientId, "envoyer un email");
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // Encode un header en RFC 2047 si non-ASCII (sujet avec accents, etc.)
    const encodeHeader = (value: string) => {
      // eslint-disable-next-line no-control-regex
      if (/^[\x00-\x7F]*$/.test(value)) return value;
      const b64 = Buffer.from(value, "utf-8").toString("base64");
      return `=?UTF-8?B?${b64}?=`;
    };

    // Construit le message au format RFC 822 (compatible Gmail API)
    const headers: string[] = [
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
    ];
    if (cc) headers.push(`Cc: ${cc}`);
    if (bcc) headers.push(`Bcc: ${bcc}`);
    const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
      ctx.log("info", `send-gmail OK → ${to}`, { id: res.data.id });
      return {
        ok: true,
        messageId: res.data.id ?? undefined,
        threadId: res.data.threadId ?? undefined,
      };
    } catch (err) {
      const msg = (err as Error).message;
      ctx.log("error", `send-gmail échec : ${msg}`);
      return { ok: false, error: msg };
    }
  },
};
