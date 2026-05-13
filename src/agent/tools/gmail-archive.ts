import { z } from "zod";
import { google } from "googleapis";
import type { ToolDefinition } from "./types";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getOAuthToken } from "@/lib/db/oauth";

const inputSchema = z.object({
  messageIds: z
    .array(z.string())
    .min(1)
    .describe(
      "Liste des IDs Gmail à traiter (récupérés via read-gmail-inbox).",
    ),
  action: z
    .enum(["archive", "trash", "label-only"])
    .default("archive")
    .describe(
      "archive = retire de la boîte de réception (label Triaged ajouté). " +
        "trash = jette dans la corbeille (récupérable 30j). " +
        "label-only = ajoute juste le label Triaged sans bouger.",
    ),
  labelName: z
    .string()
    .default("Triaged")
    .describe("Nom du label à ajouter (créé s'il n'existe pas)."),
});

export interface GmailArchiveOutput {
  ok: boolean;
  processed: number;
  failed: number;
  errors: string[];
  labelId?: string;
}

async function ensureLabel(
  gmail: ReturnType<typeof google.gmail>,
  name: string,
): Promise<string> {
  const labels = await gmail.users.labels.list({ userId: "me" });
  const existing = labels.data.labels?.find((l) => l.name === name);
  if (existing?.id) return existing.id;
  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  if (!created.data.id) throw new Error("label creation failed");
  return created.data.id;
}

export const gmailArchiveTool: ToolDefinition<
  typeof inputSchema,
  GmailArchiveOutput
> = {
  id: "gmail-archive",
  name: "Archiver / supprimer des emails Gmail",
  description:
    "Traite un lot d'emails Gmail après que tu les as classés via read-gmail-inbox. Pour les spams/non-pertinents : action='trash' (corbeille). Pour les emails déjà traités (lead extrait et poussé dans CRM) : action='archive' (label Triaged + retire de l'inbox). Toujours marquer Triaged pour éviter de re-traiter au prochain run.",
  category: "integration",
  exposedToLLM: true,
  costEstimateCents: 0,
  requiresSupervision: true, // destructif : on confirme avant
  inputSchema,
  execute: async ({ messageIds, action, labelName }, ctx) => {
    const { getAuthedGoogleClient } = await import("@/lib/google/authed-client");
    const oauth2 = await getAuthedGoogleClient(
      ctx.clientId,
      "archiver des emails",
    );

    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // Assure que le label Triaged existe
    let labelId: string;
    try {
      labelId = await ensureLabel(gmail, labelName);
    } catch (err) {
      ctx.log("error", `gmail-archive label fail: ${(err as Error).message}`);
      return {
        ok: false,
        processed: 0,
        failed: messageIds.length,
        errors: [`label setup: ${(err as Error).message}`],
      };
    }

    let processed = 0;
    const errors: string[] = [];

    for (const id of messageIds) {
      try {
        if (action === "trash") {
          await gmail.users.messages.trash({ userId: "me", id });
        } else {
          // archive / label-only : on modifie les labels
          const removeLabelIds = action === "archive" ? ["INBOX"] : [];
          await gmail.users.messages.modify({
            userId: "me",
            id,
            requestBody: {
              addLabelIds: [labelId],
              removeLabelIds,
            },
          });
        }
        processed++;
      } catch (err) {
        errors.push(`${id}: ${(err as Error).message}`);
      }
    }

    ctx.log(
      "info",
      `gmail-archive ${action}: ${processed}/${messageIds.length} OK`,
    );

    return {
      ok: errors.length === 0,
      processed,
      failed: messageIds.length - processed,
      errors,
      labelId,
    };
  },
};
