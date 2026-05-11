import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe(
      "La requête à chercher sur le web. Ex: 'météo Paris demain', 'prix carrelage 60x60 2026', 'actualités IA cette semaine'. Sois précis.",
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Nombre de résultats max (1-10, défaut 5)."),
});

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
}

export const webSearchTool: ToolDefinition<
  typeof inputSchema,
  {
    ok: boolean;
    answer?: string;
    results: Array<{ title: string; url: string; snippet: string; published?: string }>;
    error?: string;
  }
> = {
  id: "web-search",
  name: "Chercher sur le web",
  description:
    "Recherche en temps réel sur le web. À utiliser DÈS QUE tu as besoin d'une info que tu ne connais pas : actualités, prix, météo, infos pratiques, données qui changent (taux, lois récentes), faits récents sur une entreprise/personne. Préfère ce tool plutôt que de dire \"je ne sais pas\" ou de donner une info périmée. Tavily renvoie souvent une réponse synthétique en plus des sources : utilise-la.",
  category: "ai",
  exposedToLLM: true,
  costEstimateCents: 1,
  inputSchema,
  execute: async ({ query, maxResults }, ctx) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey || apiKey.includes("placeholder")) {
      ctx.log(
        "warn",
        "web-search appelé mais TAVILY_API_KEY absente — retour mock",
      );
      return {
        ok: false,
        results: [],
        error:
          "Pas de recherche web configurée (TAVILY_API_KEY manquante). Demande à l'admin d'ajouter une clé Tavily — gratuit sur https://tavily.com",
      };
    }

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: true,
          search_depth: "basic",
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        ctx.log("error", `Tavily HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        return {
          ok: false,
          results: [],
          error: `Tavily HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as TavilyResponse;
      ctx.log("info", `web-search "${query}" → ${data.results.length} résultats`);

      return {
        ok: true,
        answer: data.answer,
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content.slice(0, 300),
          published: r.published_date,
        })),
      };
    } catch (err) {
      const msg = (err as Error).message;
      ctx.log("error", `web-search exception : ${msg}`);
      return { ok: false, results: [], error: msg };
    }
  },
};
