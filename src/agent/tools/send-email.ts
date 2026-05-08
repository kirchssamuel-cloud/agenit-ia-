import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  text: z.string(),
  html: z.string().optional(),
  from: z.string().email().optional(),
});

export interface SendEmailOutput {
  ok: boolean;
  messageId?: string;
  reason?: string;
}

export const sendEmailTool: ToolDefinition<typeof inputSchema, SendEmailOutput> = {
  id: "send-email",
  name: "Envoyer un email",
  description:
    "Envoie un email transactionnel (notification, confirmation, rapport). Provider : Resend (à configurer).",
  category: "communication",
  exposedToLLM: true,
  inputSchema,
  costEstimateCents: 1,
  // Effet de bord externe (envoi réel) → validation superviseur obligatoire.
  requiresSupervision: true,
  execute: async (input, ctx) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      ctx.log("warn", "RESEND_API_KEY manquante — email simulé (non envoyé).", { to: input.to });
      return { ok: false, reason: "RESEND_API_KEY missing — email not sent (dev mode)." };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from ?? "Agent Platform <noreply@agent-platform.local>",
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      ctx.log("error", "Échec envoi email", { status: res.status, body });
      return { ok: false, reason: `HTTP ${res.status}: ${body}` };
    }
    const data = (await res.json()) as { id?: string };
    ctx.log("info", "Email envoyé", { to: input.to, messageId: data.id });
    return { ok: true, messageId: data.id };
  },
};
