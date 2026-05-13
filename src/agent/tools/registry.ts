import type { AnyTool } from "./types";
import { parseCsvTool } from "./parse-csv";
import { parseXlsxTool } from "./parse-xlsx";
import { normalizePhonesTool } from "./normalize-phones";
import { dedupRowsTool } from "./dedup-rows";
import { sendEmailTool } from "./send-email";
import { readGmailInboxTool } from "./read-gmail-inbox";
import { pushIcall26Tool } from "./push-icall26";
import { optimizeRouteTool } from "./optimize-route";
import { readIcall26LeadsTool } from "./read-icall26-leads";
import { readIcall26AppointmentsTool } from "./read-icall26-appointments";
import { readIcall26SalesPerformanceTool } from "./read-icall26-sales-performance";
import { rememberFactTool } from "./remember-fact";
import { proposeLearningTool } from "./propose-learning";
import { runModuleTool } from "./run-module";
import { webSearchTool } from "./web-search";
import { gmailArchiveTool } from "./gmail-archive";
import { readGoogleCalendarTool } from "./read-google-calendar";
import { sendWhatsAppProactiveTool } from "./send-whatsapp-proactive";
import { sendGmailTool } from "./send-gmail";
import { createCalendarEventTool } from "./create-calendar-event";
import { readGoogleDriveTool } from "./read-google-drive";
import {
  readGoogleContactsTool,
  createGoogleContactTool,
} from "./google-contacts";

export const TOOL_REGISTRY: AnyTool[] = [
  // Données
  parseCsvTool,
  parseXlsxTool,
  normalizePhonesTool,
  dedupRowsTool,
  // Communication
  sendEmailTool,
  // Intégrations CRM (lecture)
  readIcall26LeadsTool,
  readIcall26AppointmentsTool,
  readIcall26SalesPerformanceTool,
  // Intégrations CRM (écriture)
  pushIcall26Tool,
  // Intégrations externes
  readGmailInboxTool,
  gmailArchiveTool,
  sendGmailTool,
  readGoogleCalendarTool,
  createCalendarEventTool,
  readGoogleDriveTool,
  readGoogleContactsTool,
  createGoogleContactTool,
  sendWhatsAppProactiveTool,
  // Utilitaire
  optimizeRouteTool,
  runModuleTool,
  webSearchTool,
  // Méta — pour que l'agent s'améliore lui-même
  rememberFactTool,
  proposeLearningTool,
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
