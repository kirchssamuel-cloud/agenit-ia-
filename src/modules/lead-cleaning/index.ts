import { Sparkles } from "lucide-react";
import { z } from "zod";
import type { ModuleDefinition, ModuleRunResult } from "../types";
import { parseCsvTool } from "@/agent/tools/parse-csv";
import { parseXlsxTool } from "@/agent/tools/parse-xlsx";
import { normalizePhonesTool } from "@/agent/tools/normalize-phones";
import { dedupRowsTool } from "@/agent/tools/dedup-rows";
import { pushIcall26Tool } from "@/agent/tools/push-icall26";
import { sendEmailTool } from "@/agent/tools/send-email";

const configSchema = z.object({
  crmTarget: z.enum(["icall26", "hubspot", "pipedrive", "custom"]).default("icall26"),
  removeDuplicates: z.boolean().default(true),
  normalizePhones: z.boolean().default(true),
  defaultCountryCode: z.string().default("+33"),
  emailFromList: z.array(z.string().email()).default([]),
  notifyOnComplete: z.string().email().optional(),
  columnMapping: z.record(z.string(), z.string()).default({}),
});

type LeadCleaningConfig = z.infer<typeof configSchema>;
type Payload = {
  /** Contenu CSV (texte) — utilisé si fileBase64 absent */
  fileContent?: string;
  /** Fichier XLSX/XLS encodé en base64 */
  fileBase64?: string;
  fileName?: string;
};

export const leadCleaningModule: ModuleDefinition<typeof configSchema> = {
  id: "lead-cleaning",
  name: "Nettoyage de leads",
  shortDescription:
    "Récupère les fichiers de leads par mail, nettoie les données et les pousse dans le CRM.",
  longDescription:
    "Surveille une boîte mail dédiée. Quand un fichier de leads arrive (CSV/XLSX), normalise les téléphones, supprime les doublons, mappe les colonnes et envoie chaque lead au CRM via API. Notifie le manager quand c'est fait.",
  category: "leads",
  icon: Sparkles,
  version: "0.2.0",
  status: "alpha",
  pricing: { monthlyEUR: 49 },
  tools: [
    parseCsvTool.id,
    parseXlsxTool.id,
    normalizePhonesTool.id,
    dedupRowsTool.id,
    pushIcall26Tool.id,
    sendEmailTool.id,
  ],
  triggers: ["manual", "cron", "webhook"],
  configSchema,
  defaultConfig: {
    crmTarget: "icall26",
    removeDuplicates: true,
    normalizePhones: true,
    defaultCountryCode: "+33",
    emailFromList: [],
    columnMapping: {},
  },
  async run(ctx): Promise<ModuleRunResult> {
    const config = ctx.config as LeadCleaningConfig;
    const payload = ctx.payload as Payload;

    let parsedRows: Record<string, string>[] = [];
    let initialCount = 0;

    if (payload?.fileBase64) {
      const parsed = await parseXlsxTool.execute(
        { contentBase64: payload.fileBase64 },
        ctx,
      );
      parsedRows = parsed.rows;
      initialCount = parsed.rowCount;
    } else if (payload?.fileContent) {
      const parsed = await parseCsvTool.execute(
        { content: payload.fileContent },
        ctx,
      );
      parsedRows = parsed.rows;
      initialCount = parsed.rowCount;
    } else {
      return {
        ok: false,
        summary: "Aucun fichier fourni",
        error: "missing fileContent or fileBase64",
      };
    }

    let rows = parsedRows;

    if (config.normalizePhones) {
      const normalized = await normalizePhonesTool.execute(
        { rows, phoneFields: ["telephone", "tel", "phone", "mobile", "portable"], defaultCountryCode: config.defaultCountryCode },
        ctx,
      );
      rows = normalized.rows;
    }

    let duplicatesRemoved = 0;
    if (config.removeDuplicates) {
      const deduped = await dedupRowsTool.execute(
        { rows, keyFields: ["telephone", "tel", "phone", "email"] },
        ctx,
      );
      rows = deduped.rows;
      duplicatesRemoved = deduped.duplicatesRemoved;
    }

    let pushed = 0;
    let pushErrors: string[] = [];
    if (config.crmTarget === "icall26") {
      try {
        const result = await pushIcall26Tool.execute(
          { rows, columnMapping: config.columnMapping },
          ctx,
        );
        pushed = result.pushed;
        pushErrors = result.errors;
      } catch (err) {
        ctx.log("warn", "Push iCall26 indisponible — leads gardés en sortie", {
          error: (err as Error).message,
        });
        pushErrors.push((err as Error).message);
      }
    }

    if (config.notifyOnComplete) {
      await sendEmailTool.execute(
        {
          to: config.notifyOnComplete,
          subject: `[Agent Platform] ${rows.length} leads traités`,
          text: `Bonjour,\n\n${rows.length} leads nettoyés (sur ${parsed.rowCount} initialement). ${duplicatesRemoved} doublons supprimés. ${pushed} poussés vers ${config.crmTarget}.\n\n— Agent Platform`,
        },
        ctx,
      );
    }

    return {
      ok: true,
      summary: `${rows.length} leads propres (sur ${initialCount}), ${duplicatesRemoved} doublons retirés, ${pushed} poussés vers ${config.crmTarget}`,
      data: {
        initialCount,
        finalCount: rows.length,
        duplicatesRemoved,
        pushed,
        pushErrors,
        rows: rows.slice(0, 20),
      },
    };
  },
};
