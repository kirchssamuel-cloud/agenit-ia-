import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Requête de recherche (ex: 'contrat carrelage', 'devis 2026'). Vide = lister les fichiers récents.",
    ),
  maxResults: z.number().int().min(1).max(50).default(20),
  mimeTypeFilter: z
    .string()
    .optional()
    .describe(
      "Filtre MIME optionnel (ex: 'application/pdf', 'application/vnd.google-apps.spreadsheet')",
    ),
});

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
}

export interface ReadDriveOutput {
  files: DriveFile[];
  totalReturned: number;
}

export const readGoogleDriveTool: ToolDefinition<
  typeof inputSchema,
  ReadDriveOutput
> = {
  id: "read-google-drive",
  name: "Lister / chercher des fichiers Google Drive",
  description:
    "Liste les fichiers Drive du client ou cherche par nom/contenu. Utile quand l'user dit 'cherche le devis Mme Martin', 'trouve mon contrat', 'mes fichiers récents'. Retourne nom, type, lien Drive direct.",
  category: "integration",
  exposedToLLM: true,
  costEstimateCents: 0,
  inputSchema,
  execute: async ({ query, maxResults, mimeTypeFilter }, ctx) => {
    const { getAuthedGoogleClient, google } = await import(
      "@/lib/google/authed-client"
    );
    const oauth2 = await getAuthedGoogleClient(
      ctx.clientId,
      "chercher dans tes fichiers Drive",
    );
    const drive = google.drive({ version: "v3", auth: oauth2 });

    // Échappe une string pour la syntaxe Drive Query (RFC : \ avant ')
    const escapeDriveQuery = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    // Construit la query Drive (syntaxe Drive API)
    const queryParts: string[] = ["trashed = false"];
    if (query) {
      const q = escapeDriveQuery(query);
      // Cherche dans nom + contenu (fullText)
      queryParts.push(
        `(name contains '${q}' or fullText contains '${q}')`,
      );
    }
    if (mimeTypeFilter) {
      queryParts.push(`mimeType = '${escapeDriveQuery(mimeTypeFilter)}'`);
    }

    const res = await drive.files.list({
      q: queryParts.join(" and "),
      pageSize: maxResults,
      fields:
        "files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink)",
      orderBy: "modifiedTime desc",
    });

    const files: DriveFile[] = (res.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "(sans nom)",
      mimeType: f.mimeType ?? "",
      modifiedTime: f.modifiedTime ?? undefined,
      size: f.size ?? undefined,
      webViewLink: f.webViewLink ?? undefined,
      iconLink: f.iconLink ?? undefined,
    }));

    ctx.log("info", `read-google-drive ${query ?? "(récents)"} → ${files.length}`);
    return { files, totalReturned: files.length };
  },
};
