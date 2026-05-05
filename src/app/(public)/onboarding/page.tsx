import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  MessageCircle,
  Phone,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ensureLoaded, getClient, listClientModules } from "@/lib/db/store";
import { getModuleById } from "@/modules/registry";

const DEMO_PHONE = "+33 7 XX XX XX XX";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;
  if (!params.clientId) redirect("/signup");

  await ensureLoaded();
  const client = getClient(params.clientId);
  if (!client) redirect("/signup");

  const cms = listClientModules(client.id).filter((cm) => cm.enabled);
  const modules = cms
    .map((cm) => getModuleById(cm.moduleId))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-3xl font-bold">Paiement reçu, ton agent est prêt 🎉</h1>
        <p className="mt-2 text-muted-foreground">
          Bienvenue <strong>{client.name}</strong>. Voici ton activation en 30 secondes.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Tes modules actifs
          </CardTitle>
          <CardDescription>
            {modules.length} compétence{modules.length > 1 ? "s" : ""} activée
            {modules.length > 1 ? "s" : ""} pour ton agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => (
              <Badge key={m.id} variant="default" className="gap-1.5 px-2.5 py-1">
                <CheckCircle2 className="size-3" />
                {m.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-5" />
            Étape 1 — Enregistre ce numéro WhatsApp
          </CardTitle>
          <CardDescription>
            C&apos;est le numéro de ton agent personnel. Mets-le dans tes contacts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 p-6">
            <span className="font-mono text-2xl font-semibold">{DEMO_PHONE}</span>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            (Numéro de démo — un vrai numéro WhatsApp Business sera attribué via
            Twilio dès que la facturation sera connectée.)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            Étape 2 — Envoie-lui ton premier message
          </CardTitle>
          <CardDescription>
            Pas de syntaxe particulière. Parle-lui normalement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <ExampleMessage>Génère-moi un devis pour 100m² de carrelage</ExampleMessage>
            <ExampleMessage>Voici un ticket de caisse à enregistrer (avec photo)</ExampleMessage>
            <ExampleMessage>Combien de RDV j&apos;ai pris cette semaine ?</ExampleMessage>
            <ExampleMessage>Relance les leads qui n&apos;ont pas répondu depuis 7 jours</ExampleMessage>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="size-5" />
            Étape 3 — Accède à ton portail
          </CardTitle>
          <CardDescription>
            Tu y verras tes statistiques, l&apos;historique de ton agent, et tu pourras
            lancer des tâches comme la planification de tournées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" size="lg">
            <Link href={`/portal/${client.id}`}>
              Aller à mon portail <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ExampleMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <MessageCircle className="size-4 mt-0.5 text-muted-foreground" />
      <span className="text-sm">{children}</span>
    </div>
  );
}
