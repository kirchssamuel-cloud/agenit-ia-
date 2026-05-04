import {
  TrendingUp,
  Users,
  Activity,
  Euro,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ensureLoaded, listClients, listClientModules } from "@/lib/db/store";
import { listRecentRuns } from "@/lib/db/runs";
import { MODULE_REGISTRY, getModuleById } from "@/modules/registry";

export default async function DashboardPage() {
  await ensureLoaded();
  const clients = listClients();

  // MRR calculé depuis les modules activés
  let mrr = 0;
  let activeModulesCount = 0;
  for (const c of clients) {
    const cms = listClientModules(c.id).filter((cm) => cm.enabled);
    activeModulesCount += cms.length;
    for (const cm of cms) {
      const m = getModuleById(cm.moduleId);
      mrr += m?.pricing?.monthlyEUR ?? 0;
    }
  }

  let recentRuns: Awaited<ReturnType<typeof listRecentRuns>> = [];
  try {
    recentRuns = await listRecentRuns(20);
  } catch {
    recentRuns = [];
  }

  const last7d = recentRuns.filter(
    (r) => Date.now() - new Date(r.startedAt).getTime() < 7 * 24 * 3600 * 1000,
  );
  const successCount = last7d.filter((r) => r.status === "success").length;
  const errorCount = last7d.filter((r) => r.status === "error").length;
  const successRate =
    last7d.length > 0 ? Math.round((successCount / last7d.length) * 100) : 0;

  return (
    <>
      <AdminTopbar
        title="Dashboard"
        description="Vue d'ensemble de ta plateforme d'agents IA."
      />
      <div className="flex flex-col gap-6 p-8">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="MRR estimé"
            value={`${mrr} €`}
            sub={`${activeModulesCount} module${activeModulesCount > 1 ? "s" : ""} actif${activeModulesCount > 1 ? "s" : ""}`}
            icon={<Euro className="size-4" />}
            tone="success"
          />
          <KpiCard
            label="Clients"
            value={String(clients.length)}
            sub={`${clients.filter((c) => listClientModules(c.id).some((cm) => cm.enabled)).length} en service`}
            icon={<Users className="size-4" />}
          />
          <KpiCard
            label="Exécutions (7j)"
            value={String(last7d.length)}
            sub={`${successCount} OK · ${errorCount} erreurs`}
            icon={<Activity className="size-4" />}
          />
          <KpiCard
            label="Taux de succès"
            value={`${successRate}%`}
            sub="sur les 7 derniers jours"
            icon={<TrendingUp className="size-4" />}
            tone={successRate >= 95 ? "success" : successRate >= 80 ? "neutral" : "warn"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Activité en temps réel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="size-4" />
                Activité en temps réel
              </CardTitle>
              <CardDescription>
                Les 20 dernières exécutions tous clients confondus.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pas encore d&apos;activité. Lance une démo depuis le Playground.
                </p>
              ) : (
                <div className="flex flex-col">
                  {recentRuns.map((r) => {
                    const mod = getModuleById(r.moduleId);
                    const client = clients.find((c) => c.id === r.clientId);
                    const ok = r.status === "success";
                    return (
                      <div
                        key={r.id}
                        className="flex items-start gap-3 border-b border-border py-2.5 last:border-0"
                      >
                        {ok ? (
                          <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="size-4 mt-0.5 shrink-0 text-destructive" />
                        )}
                        <div className="flex flex-1 min-w-0 flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{client?.name ?? "—"}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-sm text-muted-foreground">
                              {mod?.name ?? r.moduleId}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">
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

          {/* Clients récents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" />
                Clients récents
              </CardTitle>
              <CardDescription>Triés par date d&apos;ajout.</CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun client. Va sur la page Clients pour en créer un.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {clients
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .slice(0, 8)
                    .map((c) => {
                      const cms = listClientModules(c.id).filter((cm) => cm.enabled);
                      return (
                        <Link
                          key={c.id}
                          href={`/clients/${c.id}`}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-accent"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.industry ?? "—"}
                            </span>
                          </div>
                          <Badge variant={cms.length > 0 ? "default" : "outline"}>
                            {cms.length} module{cms.length > 1 ? "s" : ""}
                          </Badge>
                        </Link>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Catalogue */}
        <Card>
          <CardHeader>
            <CardTitle>Catalogue actuel</CardTitle>
            <CardDescription>
              Tous les modules vendables — prix mensuel × clients actifs = revenu mensuel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {MODULE_REGISTRY.map((m) => {
                const Icon = m.icon;
                const activeFor = clients.filter((c) =>
                  listClientModules(c.id).some(
                    (cm) => cm.moduleId === m.id && cm.enabled,
                  ),
                ).length;
                const monthly = (m.pricing?.monthlyEUR ?? 0) * activeFor;
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.name}</span>
                        <Badge variant="outline">{m.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {m.pricing?.monthlyEUR ?? 0} €/mois · {activeFor} client
                        {activeFor > 1 ? "s" : ""} · {monthly} €/mois
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: "neutral" | "success" | "warn";
}) {
  const ring =
    tone === "success"
      ? "ring-1 ring-emerald-500/30"
      : tone === "warn"
        ? "ring-1 ring-amber-500/30"
        : "";
  return (
    <Card className={ring}>
      <CardContent className="flex flex-col gap-1 p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-muted-foreground truncate">{sub}</span>
      </CardContent>
    </Card>
  );
}
