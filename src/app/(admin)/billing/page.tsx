import { Receipt, Euro, TrendingUp, Users } from "lucide-react";
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
import { getModuleById } from "@/modules/registry";

export default async function BillingPage() {
  await ensureLoaded();
  const clients = listClients();

  const rows = clients.map((c) => {
    const cms = listClientModules(c.id).filter((cm) => cm.enabled);
    let monthly = 0;
    const moduleNames: string[] = [];
    for (const cm of cms) {
      const m = getModuleById(cm.moduleId);
      if (!m) continue;
      monthly += m.pricing?.monthlyEUR ?? 0;
      moduleNames.push(m.name);
    }
    return { client: c, cms, monthly, moduleNames };
  });

  const mrr = rows.reduce((s, r) => s + r.monthly, 0);
  const paying = rows.filter((r) => r.monthly > 0).length;

  return (
    <>
      <AdminTopbar
        title="Facturation"
        description="Revenus, abonnements actifs, factures à venir."
      />
      <div className="flex flex-col gap-6 p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard
            label="MRR"
            value={`${mrr} €`}
            sub="revenu mensuel récurrent estimé"
            icon={<Euro className="size-4" />}
          />
          <KpiCard
            label="ARR"
            value={`${mrr * 12} €`}
            sub="annualisé"
            icon={<TrendingUp className="size-4" />}
          />
          <KpiCard
            label="Clients payants"
            value={String(paying)}
            sub={`sur ${clients.length} inscrits`}
            icon={<Users className="size-4" />}
          />
          <KpiCard
            label="ARPU"
            value={paying > 0 ? `${Math.round(mrr / paying)} €` : "—"}
            sub="revenu moyen par client"
            icon={<Receipt className="size-4" />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Abonnements actifs</CardTitle>
            <CardDescription>
              Modules activés et revenu mensuel estimé par client.
              <br />
              <span className="text-xs">
                💡 Stripe pas encore branché : ces montants sont théoriques (calcul
                depuis les modules activés × prix catalogue).
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun client.</p>
            ) : (
              <div className="flex flex-col">
                {rows
                  .sort((a, b) => b.monthly - a.monthly)
                  .map(({ client, cms, monthly, moduleNames }) => (
                    <Link
                      key={client.id}
                      href={`/clients/${client.id}`}
                      className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-0 hover:bg-accent/30"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{client.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {moduleNames.length > 0
                            ? moduleNames.join(" + ")
                            : "Aucun module actif"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{cms.length} module{cms.length > 1 ? "s" : ""}</Badge>
                        <span className="font-semibold">
                          {monthly} €<span className="text-xs text-muted-foreground">/mois</span>
                        </span>
                      </div>
                    </Link>
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
