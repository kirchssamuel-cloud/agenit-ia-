import { z } from "zod";
import * as XLSX from "xlsx";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  /** Contenu binaire encodé en base64 (pour transit JSON / server actions) */
  contentBase64: z.string().describe("Fichier XLSX/XLS en base64"),
  /** Nom de la feuille à lire. Si absent, prend la première. */
  sheetName: z.string().optional(),
});

export interface ParsedXlsx {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export const parseXlsxTool: ToolDefinition<typeof inputSchema, ParsedXlsx> = {
  id: "parse-xlsx",
  name: "Parser un fichier Excel (.xlsx / .xls)",
  description:
    "Lit un fichier Excel et retourne en-têtes + lignes typés. Auto-détecte la première feuille si non précisée.",
  category: "data",
  exposedToLLM: false,
  inputSchema,
  execute: async ({ contentBase64, sheetName }, ctx) => {
    const buffer = Buffer.from(contentBase64, "base64");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const target = sheetName ?? wb.SheetNames[0];
    if (!target || !wb.Sheets[target]) {
      throw new Error(
        `Feuille introuvable. Disponibles : ${wb.SheetNames.join(", ") || "aucune"}`,
      );
    }
    const sheet = wb.Sheets[target];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    const rows = json.map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        out[String(k).trim()] = v == null ? "" : String(v).trim();
      }
      return out;
    });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    ctx.log("info", `XLSX parsé : ${rows.length} ligne(s), feuille « ${target} »`, {
      sheets: wb.SheetNames,
      headers,
    });
    return { sheetName: target, headers, rows, rowCount: rows.length };
  },
};
