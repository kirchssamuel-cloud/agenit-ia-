import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Building2, Link2, CheckCircle2, History, CheckCircle, XCircle, Brain } from "lucide-react";
import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getClient, listClientModules, ensureLoaded } from "@/lib/db/store";
import { getOAuthToken } from "@/lib/db/oauth";
import { listRunsForClient } from "@/lib/db/runs";
import { listClientFacts } from "@/lib/db/agent-brain";
import { MODULE_REGISTRY, getModuleById } from "@/modules/registry";
import { ModuleToggle } from "./module-toggle";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureLoaded();
  const client = getClient(id);
  if (!client) notFound();

  const cms = listClientModules(id);
  const enabledMap = new Map(cms.map((cm) => [cm.moduleId, cm.enabled]));
  const activeCount = cms.filter((cm) => cm.enabled).length;

  let googleToken: Awaited<ReturnType<typeof getOAuthToken>> = null;
  try {
    googleToken = await getOAuthToken(id, "google");
  } catch {
    googleToken = null;
  }

  let runs: Awaited<ReturnType<typeof listRunsForClient>> = [];
  try {
    runs = await listRunsForClient(id, 15);
  } catch {
    runs = [];
  }

  let facts: Awaited<ReturnType<typeof listClientFacts>> = [];
  try {
    facts = await listClientFacts(id);
  } catch {
    facts = [];
  }
  const factsByCategory = new Map<string, typeof facts>();
  for (const f of facts) {
    const arr = factsByCategory.get(f.category) ?? [];
    arr.push(f);
    factsByCategory.set(f.category, arr);
  }

  return (
    <>
      <AdminTopbar
        title={client.name}
        description={client.industry ?? "Client"}
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Retour à la liste
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href={`/portal/${client.id}`} target="_blank">
              Voir comme le client →
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Informations</CardTitle>
              <CardDescription>Contact principal et notes</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" />
                <span className="text-foreground">{client.contactEmail}</span>
              </div>
              {client.contactPhone ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" />
                  <span className="text-foreground">{client.contactPhone}</span>
                </div>
              ) : null}
              {client.industry ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-4" />
                  <span className="text-foreground">{client.industry}</span>
                </div>
              ) : null}
              {client.notes ? (
                <>
                  <Separator />
                  <p className="text-muted-foreground">{client.notes}</p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-5" /> Connexions externes
              </CardTitle>
              <CardDescription>
                Comptes du client connectés à la plateforme. Permettent à l&apos;agent
                d&apos;agir directement sur ses outils.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Mail className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Gmail</span>
                    {googleToken ? (
                      <span className="text-xs text-muted-foreground">
                        Connecté : {googleToken.accountEmail ?? "compte Google"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Non connecté
                      </span>
                    )}
                  </div>
                </div>
                {googleToken ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="size-3" /> Actif
                  </Badge>
                ) : (
                  <Button asChild size="sm">
                    <a href={`/api/oauth/google/start?clientId=${client.id}`}>
                      Connecter Gmail
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-5" />
                Mémoire de l&apos;agent
                <Badge variant="secondary">{facts.length} fait{facts.length > 1 ? "s" : ""}</Badge>
              </CardTitle>
              <CardDescription>
                Tout ce que l&apos;agent a appris sur ce client au fil des conversations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {facts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  L&apos;agent n&apos;a encore rien mémorisé. À chaque conversation, il
                  apprend et stocke ici ce qui doit persister (préférences, tarifs, équipe,
                  process).
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {Array.from(factsByCategory.entries()).map(([cat, list]) => (
                    <div key={cat}>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {cat}
                      </h4>
                      <ul className="flex flex-col gap-1">
                        {list.map((f) => (
                          <li key={f.id} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span className="flex-1">{f.fact}</span>
                            {f.confidence < 0.8 ? (
                              <Badge variant="outline" className="text-[10px]">
                                à vérifier
                              </Badge>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" />
                Historique d&apos;exécution
                <Badge variant="secondary">{runs.length}</Badge>
              </CardTitle>
              <CardDescription>
                Les 15 dernières exécutions de modules pour ce client.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune exécution pour le moment. Lance un module depuis le Playground pour
                  voir l&apos;historique se remplir.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {runs.map((r) => {
                    const mod = getModuleById(r.moduleId);
                    const isSuccess = r.status === "success";
                    return (
                      <div
                        key={r.id}
                        className="flex items-start gap-3 rounded-md border border-border p-3 text-sm"
                      >
                        {isSuccess ? (
                          <CheckCircle className="size-4 mt-0.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="size-4 mt-0.5 text-destructive shrink-0" />
                        )}
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{mod?.name ?? r.moduleId}</span>
                            <Badge variant={isSuccess ? "default" : "destructive"}>
                              {r.status}
                            </Badge>
                            {r.durationMs != null ? (
                              <span className="text-xs text-muted-foreground">
                                {r.durationMs} ms
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground truncate">
                            {r.summary ?? r.errorMessage ?? "—"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Modules attribués
                <Badge variant="secondary">{activeCount} actif{activeCount > 1 ? "s" : ""}</Badge>
              </CardTitle>
              <CardDescription>
                Activez ou désactivez les compétences de l&apos;agent pour ce client.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {MODULE_REGISTRY.map((m) => {
                const Icon = m.icon;
                const enabled = enabledMap.get(m.id) ?? false;
                return (
                  <div
                    key={m.id}
                    className="flex items-start gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{m.name}</h3>
                        <Badge variant={m.status === "stable" ? "default" : "outline"}>
                          {m.status}
                        </Badge>
                        {m.pricing?.monthlyEUR ? (
                          <span className="text-xs text-muted-foreground">
                            {m.pricing.monthlyEUR} €/mois
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{m.shortDescription}</p>
                    </div>
                    <ModuleToggle
                      clientId={client.id}
                      moduleId={m.id}
                      initialEnabled={enabled}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
