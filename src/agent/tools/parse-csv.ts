import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  content: z.string().describe("Contenu brut du fichier CSV"),
  delimiter: z.string().optional().describe("Délimiteur. Auto-détecté si absent (',' ou ';')."),
});

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export const parseCsvTool: ToolDefinition<typeof inputSchema, ParsedCsv> = {
  id: "parse-csv",
  name: "Parser un fichier CSV",
  description:
    "Lit un CSV (avec auto-détection du délimiteur , ou ;) et retourne les en-têtes et lignes typés.",
  category: "data",
  exposedToLLM: false,
  inputSchema,
  execute: async ({ content, delimiter }, ctx) => {
    const text = content.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
    const firstLine = text.split("\n")[0] ?? "";
    const delim =
      delimiter ??
      (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");

    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { headers: [], rows: [], rowCount: 0 };
    }
    const headers = splitCsvLine(lines[0], delim).map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line, delim);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (cells[i] ?? "").trim();
      });
      return obj;
    });
    ctx.log("info", `CSV parsé : ${rows.length} ligne(s)`, { delimiter: delim, headers });
    return { headers, rows, rowCount: rows.length };
  },
};

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
