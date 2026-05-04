import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Building2, Link2, CheckCircle2 } from "lucide-react";
import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getClient, listClientModules, ensureLoaded } from "@/lib/db/store";
import { getOAuthToken } from "@/lib/db/oauth";
import { MODULE_REGISTRY } from "@/modules/registry";
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
    // Si la table client_oauth_tokens n'existe pas encore, on ignore.
    googleToken = null;
  }

  return (
    <>
      <AdminTopbar
        title={client.name}
        description={client.industry ?? "Client"}
      />
      <div className="flex flex-col gap-6 p-8">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Retour à la liste
        </Link>

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
