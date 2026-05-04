import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MODULE_REGISTRY } from "@/modules/registry";
import { countClientsForModule, ensureLoaded } from "@/lib/db/store";

const CATEGORY_LABELS: Record<string, string> = {
  leads: "Leads",
  scheduling: "Planning",
  communication: "Communication",
  accounting: "Comptabilité",
  documents: "Documents",
  other: "Autres",
};

export default async function ModulesPage() {
  await ensureLoaded();
  return (
    <>
      <AdminTopbar
        title="Catalogue de modules"
        description="Toutes les compétences disponibles dans la plateforme. Chaque module ajouté au code apparaît automatiquement ici."
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULE_REGISTRY.map((m) => {
            const Icon = m.icon;
            const usedBy = countClientsForModule(m.id);
            return (
              <Card key={m.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant={m.status === "stable" ? "default" : "outline"}>
                      {m.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-3">{m.name}</CardTitle>
                  <CardDescription>{m.shortDescription}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {m.longDescription ? (
                    <p className="text-muted-foreground leading-relaxed">{m.longDescription}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{CATEGORY_LABELS[m.category] ?? m.category}</Badge>
                    <span>v{m.version}</span>
                    {m.pricing?.monthlyEUR ? <span>{m.pricing.monthlyEUR} €/mois</span> : null}
                    <span className="ml-auto">
                      {usedBy} client{usedBy > 1 ? "s" : ""} actif{usedBy > 1 ? "s" : ""}
                    </span>
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
