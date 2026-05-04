import {
  GraduationCap,
  Brain,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listSkills, listLearnings } from "@/lib/db/agent-skills";
import { ensureLoaded, listClients } from "@/lib/db/store";
import { MODULE_REGISTRY, getModuleById } from "@/modules/registry";
import { NewSkillDialog } from "./new-skill-dialog";
import { AgentTestChat } from "./agent-test-chat";

export default async function EducationPage() {
  await ensureLoaded();
  const clients = listClients().map((c) => ({ id: c.id, name: c.name }));

  let skills: Awaited<ReturnType<typeof listSkills>> = [];
  let learnings: Awaited<ReturnType<typeof listLearnings>> = [];
  let migrationMissing = false;
  try {
    skills = await listSkills();
    learnings = await listLearnings(20);
  } catch (err) {
    if ((err as Error).message.includes("schema cache")) {
      migrationMissing = true;
    }
  }

  const active = skills.filter((s) => s.status === "active");
  const drafts = skills.filter((s) => s.status === "draft");

  return (
    <>
      <AdminTopbar
        title="Éducation Agent"
        description="Apprends de nouvelles compétences à ton agent. Il garde tout en mémoire et s'améliore avec le temps."
      />
      <div className="flex flex-col gap-6 p-8">
        {migrationMissing ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 text-sm">
              ⚠️ La table <code className="font-mono">agent_skills</code> n&apos;existe pas
              encore en base. Exécute la migration{" "}
              <code className="font-mono">supabase/migrations/003_agent_intelligence.sql</code>{" "}
              dans Supabase → SQL Editor pour activer cette page.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            label="Compétences actives"
            value={String(active.length)}
            sub={`${drafts.length} en brouillon`}
            icon={<Brain className="size-4" />}
          />
          <KpiCard
            label="Total enseigné"
            value={String(skills.length)}
            sub="depuis le début"
            icon={<GraduationCap className="size-4" />}
          />
          <KpiCard
            label="Apprentissages auto"
            value={String(learnings.length)}
            sub={`${learnings.filter((l) => l.approvedByAdmin).length} approuvés`}
            icon={<Sparkles className="size-4" />}
          />
          <KpiCard
            label="Taux de réussite"
            value={
              skills.reduce((s, sk) => s + sk.usesCount, 0) > 0
                ? `${Math.round(
                    (skills.reduce((s, sk) => s + sk.successCount, 0) /
                      skills.reduce((s, sk) => s + sk.usesCount, 0)) *
                      100,
                  )}%`
                : "—"
            }
            sub="moyenne sur toutes les compétences"
            icon={<TrendingUp className="size-4" />}
          />
        </div>

        <AgentTestChat clients={clients} />

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Chaque compétence = un comportement que ton agent maîtrise.
          </p>
          <NewSkillDialog
            modules={MODULE_REGISTRY.map((m) => ({ id: m.id, name: m.name }))}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bibliothèque de compétences</CardTitle>
            <CardDescription>
              Ce que ton agent sait faire aujourd&apos;hui. Tu peux activer, archiver
              ou éditer chacune.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skills.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Brain className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground max-w-md">
                  Ton agent n&apos;a encore rien appris. Clique « Apprendre une
                  compétence » pour commencer son éducation.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {skills.map((s) => {
                  const mod = s.moduleId ? getModuleById(s.moduleId) : null;
                  return (
                    <div
                      key={s.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <h3 className="text-sm font-semibold">{s.name}</h3>
                          {s.description ? (
                            <p className="text-xs text-muted-foreground">
                              {s.description}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant={
                            s.status === "active"
                              ? "default"
                              : s.status === "draft"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {s.status}
                        </Badge>
                      </div>

                      {s.triggerPattern ? (
                        <div className="rounded-md bg-muted/50 p-2 text-xs">
                          <span className="text-muted-foreground">
                            Déclencheur :{" "}
                          </span>
                          <span className="font-mono">{s.triggerPattern}</span>
                        </div>
                      ) : null}

                      {s.actionTemplate ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {s.actionTemplate}
                        </p>
                      ) : null}

                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {mod ? <Badge variant="outline">{mod.name}</Badge> : null}
                        <span>{s.usesCount} utilisations</span>
                        {s.lastUsedAt ? (
                          <span>
                            <Clock className="mr-1 inline size-3" />
                            {new Date(s.lastUsedAt).toLocaleDateString("fr-FR")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Apprentissages récents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Apprentissages récents
            </CardTitle>
            <CardDescription>
              Auto-corrections et nouvelles compétences proposées par l&apos;agent.
              Tu valides celles que tu veux garder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {learnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                L&apos;agent n&apos;a pas encore proposé d&apos;apprentissage. Ça
                viendra dès qu&apos;il aura traité des conversations.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {learnings.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-3 rounded-md border border-border p-3"
                  >
                    <Sparkles className="size-4 mt-0.5 shrink-0 text-amber-400" />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{l.type}</Badge>
                        {l.approvedByAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="size-3" /> Approuvé
                          </Badge>
                        ) : (
                          <Badge variant="secondary">À valider</Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(l.createdAt).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-sm">{l.reason ?? "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
}: {
  label: string;
  value: string;
  sub: string;
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
        <span className="text-xs text-muted-foreground truncate">{sub}</span>
      </CardContent>
    </Card>
  );
}
