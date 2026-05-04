import type { AnyTool } from "./types";
import { parseCsvTool } from "./parse-csv";
import { parseXlsxTool } from "./parse-xlsx";
import { normalizePhonesTool } from "./normalize-phones";
import { dedupRowsTool } from "./dedup-rows";
import { sendEmailTool } from "./send-email";
import { readGmailInboxTool } from "./read-gmail-inbox";
import { pushIcall26Tool } from "./push-icall26";
import { optimizeRouteTool } from "./optimize-route";

export const TOOL_REGISTRY: AnyTool[] = [
  parseCsvTool,
  parseXlsxTool,
  normalizePhonesTool,
  dedupRowsTool,
  sendEmailTool,
  readGmailInboxTool,
  pushIcall26Tool,
  optimizeRouteTool,
];

const byId = new Map<string, AnyTool>(TOOL_REGISTRY.map((t) => [t.id, t]));

export function getToolById(id: string): AnyTool | undefined {
  return byId.get(id);
}

export function getToolsByIds(ids: readonly string[]): AnyTool[] {
  return ids.map((id) => {
    const t = byId.get(id);
    if (!t) throw new Error(`Tool not found: ${id}`);
    return t;
  });
}
