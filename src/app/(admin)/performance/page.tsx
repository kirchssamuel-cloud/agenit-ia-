import {
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Activity,
  Brain,
} from "lucide-react";
import { AdminTopbar } from "@/components/admin/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRecentRuns } from "@/lib/db/runs";
import { listSkills } from "@/lib/db/agent-skills";
import { MODULE_REGISTRY, getModuleById } from "@/modules/registry";

export default async function PerformancePage() {
  let runs: Awaited<ReturnType<typeof listRecentRuns>> = [];
  let skills: Awaited<ReturnType<typeof listSkills>> = [];
  try {
    runs = await listRecentRuns(500);
  } catch {
    runs = [];
  }
  try {
    skills = await listSkills();
  } catch {
    skills = [];
  }

  const buckets: Record<string, { total: number; success: number }> = {};
  for (const r of runs) {
    const key = r.moduleId;
    buckets[key] ??= { total: 0, success: 0 };
    buckets[key].total++;
    if (r.status === "success") buckets[key].success++;
  }

  const successRateGlobal =
    runs.length > 0
      ? Math.round(
          (runs.filter((r) => r.status === "success").length / runs.length) *
            100,
        )
      : 0;

  return (
    <>
      <AdminTopbar
        title="Performance Agent"
        description="Métriques d'évolution de ton agent. Mesure son apprentissage dans le temps."
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            label="Exécutions totales"
            value={String(runs.length)}
            icon={<Activity className="size-4" />}
          />
          <KpiCard
            label="Taux de succès global"
            value={`${successRateGlobal}%`}
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          />
          <KpiCard
            label="Erreurs totales"
            value={String(runs.filter((r) => r.status === "error").length)}
            icon={<AlertCircle className="size-4 text-destructive" />}
          />
          <KpiCard
            label="Compétences apprises"
            value={String(skills.length)}
            icon={<Brain className="size-4" />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4" />
              Performance par module
            </CardTitle>
            <CardDescription>
              Pour chaque module : nombre d&apos;exécutions et taux de réussite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(buckets).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune donnée. Lance des modules depuis le Playground pour voir
                la performance se construire.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {Object.entries(buckets).map(([moduleId, stats]) => {
                  const mod = getModuleById(moduleId);
                  const rate = Math.round((stats.success / stats.total) * 100);
                  return (
                    <div key={moduleId} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{mod?.name ?? moduleId}</span>
                        <span className="text-muted-foreground">
                          {stats.success}/{stats.total} · {rate}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${rate >= 90 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-500" : "bg-destructive"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Couverture du catalogue</CardTitle>
            <CardDescription>
              Modules qui ont déjà tourné vs ceux jamais utilisés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {MODULE_REGISTRY.map((m) => {
                const used = buckets[m.id]?.total ?? 0;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                  >
                    <span>{m.name}</span>
                    <span
                      className={
                        used > 0 ? "text-emerald-500" : "text-muted-foreground"
                      }
                    >
                      {used > 0 ? `${used} runs` : "Jamais utilisé"}
                    </span>
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
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </div>
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
      </CardContent>
    </Card>
  );
}
