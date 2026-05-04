import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TOOL_REGISTRY } from "@/agent/tools/registry";
import { MODULE_REGISTRY } from "@/modules/registry";

const CATEGORY_LABELS: Record<string, string> = {
  data: "Données",
  communication: "Communication",
  integration: "Intégration",
  documents: "Documents",
  ai: "IA",
  utility: "Utilitaire",
};

export default function ToolsPage() {
  // Pour chaque tool : par quels modules est-il utilisé
  const usedBy = new Map<string, string[]>();
  for (const m of MODULE_REGISTRY) {
    for (const tid of m.tools) {
      const arr = usedBy.get(tid) ?? [];
      arr.push(m.name);
      usedBy.set(tid, arr);
    }
  }

  return (
    <>
      <AdminTopbar
        title="Compétences de l'agent (tools)"
        description="Briques atomiques que l'agent sait exécuter. Les modules vendus aux clients sont des combinaisons de ces tools."
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TOOL_REGISTRY.map((t) => {
            const consumers = usedBy.get(t.id) ?? [];
            return (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant="outline">{CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                  </div>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{t.id}</span>
                    {t.exposedToLLM ? (
                      <Badge variant="secondary">exposé au LLM</Badge>
                    ) : (
                      <Badge variant="outline">interne</Badge>
                    )}
                  </div>
                  <div>
                    Utilisé par :{" "}
                    {consumers.length === 0 ? (
                      <span>aucun module pour le moment</span>
                    ) : (
                      consumers.join(", ")
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
