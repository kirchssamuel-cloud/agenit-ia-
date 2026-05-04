import { notFound } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Mail,
  Clock,
  Sparkles,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ensureLoaded, getClient, listClientModules } from "@/lib/db/store";
import { getOAuthToken } from "@/lib/db/oauth";
import { listRunsForClient } from "@/lib/db/runs";
import { getModuleById, MODULE_REGISTRY } from "@/modules/registry";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) notFound();

  const cms = listClientModules(clientId).filter((cm) => cm.enabled);

  let googleToken: Awaited<ReturnType<typeof getOAuthToken>> = null;
  try {
    googleToken = await getOAuthToken(clientId, "google");
  } catch {
    googleToken = null;
  }

  let runs: Awaited<ReturnType<typeof listRunsForClient>> = [];
  try {
    runs = await listRunsForClient(clientId, 50);
  } catch {
    runs = [];
  }

  const last7d = runs.filter(
    (r) => Date.now() - new Date(r.startedAt).getTime() < 7 * 24 * 3600 * 1000,
  );
  const successCount = last7d.filter((r) => r.status === "success").length;
  const errorCount = last7d.filter((r) => r.status === "error").length;
  const lastRun = runs[0] ?? null;

  // Stats par module
  const statsByModule = new Map<string, { total: number; success: number }>();
  for (const r of last7d) {
    const cur = statsByModule.get(r.moduleId) ?? { total: 0, success: 0 };
    cur.total++;
    if (r.status === "success") cur.success++;
    statsByModule.set(r.moduleId, cur);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{client.name}</span>
            <span className="text-xs text-muted-foreground">
              <Building2 className="mr-1 inline size-3" />
              {client.industry ?? "Espace agent"}
            </span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Mis à jour : {new Date().toLocaleString("fr-FR")}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour 👋 — voici ce que ton agent a fait pour toi cette semaine.
        </h1>

        <div className="grid gap-4 md:grid-cols-4">
          <KPI
            icon={<Activity className="size-4" />}
            label="Exécutions (7j)"
            value={String(last7d.length)}
            sub={`${successCount} OK · ${errorCount} erreurs`}
          />
          <KPI
            icon={<CheckCircle2 className="size-4 text-emerald-600" />}
            label="Taux de succès"
            value={
              last7d.length > 0
                ? `${Math.round((successCount / last7d.length) * 100)}%`
                : "—"
            }
            sub={`${cms.length} module${cms.length > 1 ? "s" : ""} actif${cms.length > 1 ? "s" : ""}`}
          />
          <KPI
            icon={<Mail className="size-4" />}
            label="Compte Gmail"
            value={googleToken ? "Connecté" : "Non"}
            sub={googleToken?.accountEmail ?? "Connecte ta boîte"}
          />
          <KPI
            icon={<Clock className="size-4" />}
            label="Dernière exécution"
            value={
              lastRun
                ? new Date(lastRun.startedAt).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "—"
            }
            sub={lastRun?.summary?.slice(0, 40) ?? "Aucune pour l'instant"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tes modules actifs</CardTitle>
            <CardDescription>
              Chaque module est une compétence que ton agent exécute pour toi.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun module actif. Contacte ton agence pour en activer.
              </p>
            ) : (
              MODULE_REGISTRY.filter((m) =>
                cms.some((cm) => cm.moduleId === m.id),
              ).map((m) => {
                const Icon = m.icon;
                const stats = statsByModule.get(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{m.name}</h3>
                        <Badge variant="outline">v{m.version}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {m.shortDescription}
                      </p>
                    </div>
                    <div className="flex flex-col items-end text-xs text-muted-foreground">
                      {stats ? (
                        <>
                          <span className="font-semibold text-foreground">
                            {stats.success}/{stats.total}
                          </span>
                          <span>réussis (7j)</span>
                        </>
                      ) : (
                        <span>Aucune exécution</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>
              Les 20 dernières actions exécutées par ton agent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas d&apos;activité pour le moment.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {runs.slice(0, 20).map((r) => {
                  const mod = getModuleById(r.moduleId);
                  const Icon = mod?.icon ?? Activity;
                  const isSuccess = r.status === "success";
                  return (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 border-b border-border pb-3 last:border-0"
                    >
                      {isSuccess ? (
                        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="size-4 mt-0.5 shrink-0 text-destructive" />
                      )}
                      <div className="flex flex-1 min-w-0 flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {mod?.name ?? r.moduleId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {r.summary ?? r.errorMessage ?? "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />
        <p className="text-center text-xs text-muted-foreground">
          Espace personnel · Géré par Agent Platform
        </p>
      </main>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <span className="text-2xl font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground truncate">{sub}</span>
      </CardContent>
    </Card>
  );
}
