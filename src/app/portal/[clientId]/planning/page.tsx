import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Map as MapIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ensureLoaded, getClient } from "@/lib/db/store";
import { PlanningForm } from "./planning-form";

export default async function PortalPlanningPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await ensureLoaded();
  const client = getClient(clientId);
  if (!client) notFound();

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
              Optimisation de tournées
            </span>
          </div>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href={`/portal/${client.id}`}>
              <ArrowLeft className="size-4" /> Retour au portail
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <MapIcon className="size-6" />
            <h1 className="text-3xl font-bold">Planifier les tournées</h1>
            <Badge variant="outline">Aperçu</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Saisis tes commerciaux et tes RDV. Notre agent calcule la tournée
            optimale pour chacun en minimisant les trajets et en respectant la
            contrainte de temps maximum entre deux RDV.
          </p>
        </div>

        <PlanningForm clientId={client.id} />
      </main>
    </div>
  );
}
