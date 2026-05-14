import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  MessageCircle,
  Phone,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  Mail,
  Calendar,
  Folder,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ensureLoaded, getClient, listClientModules } from "@/lib/db/store";
import { getOAuthToken } from "@/lib/db/oauth";
import { getModuleById } from "@/modules/registry";

const DEMO_PHONE = "+33 7 XX XX XX XX";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    google?: string;
    oauth_error?: string;
  }>;
}) {
  const params = await searchParams;
  if (!params.clientId) redirect("/signup");

  await ensureLoaded();
  const client = getClient(params.clientId);
  if (!client) redirect("/signup");

  const justConnectedGoogle = params.google === "connected";
  const oauthError = params.oauth_error;

  const cms = listClientModules(client.id).filter((cm) => cm.enabled);
  const modules = cms
    .map((cm) => getModuleById(cm.moduleId))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  // Check Google OAuth status — étape 1 obligatoire
  const googleToken = await getOAuthToken(client.id, "google");
  const googleConnected = Boolean(googleToken?.accessToken);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-3xl font-bold">Paiement reçu, ton agent est prêt 🎉</h1>
        <p className="mt-2 text-muted-foreground">
          Bienvenue <strong>{client.name}</strong>. Voici ton activation en 1 minute.
        </p>
      </div>

      {justConnectedGoogle && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-emerald-700 dark:text-emerald-300">
              Google connecté ✨
            </div>
            <div className="text-muted-foreground">
              Ton agent a accès à Gmail, Calendar, Drive et Contacts. Passe à
              l&apos;étape suivante.
            </div>
          </div>
        </div>
      )}
      {oauthError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <div className="font-semibold text-red-600">
            Connexion Google interrompue
          </div>
          <div className="text-muted-foreground mt-1">
            {decodeURIComponent(oauthError).slice(0, 200)}
          </div>
        </div>
      )}

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

      {/* ÉTAPE 1 — Connecter Google (avant WhatsApp pour éviter friction OAuth) */}
      <Card
        className={
          googleConnected
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-[#F97316]/40 bg-[#F97316]/5"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {googleConnected ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <ShieldCheck className="size-5 text-[#F97316]" />
            )}
            Étape 1 — Connecte ton compte Google
            {googleConnected && (
              <Badge variant="outline" className="ml-2 border-emerald-500/50 text-emerald-600">
                Connecté
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {googleConnected
              ? "Ton agent a accès à Gmail, Calendar, Drive et Contacts. Tu peux gérer ça à tout moment dans tes connexions."
              : "Fais-le maintenant en 30 s pour que ton agent puisse agir dès que tu lui parles. Sinon il te demandera au moment de la première action."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <PermissionItem icon={<Mail className="size-4" />} label="Gmail" />
            <PermissionItem icon={<Calendar className="size-4" />} label="Calendar" />
            <PermissionItem icon={<Folder className="size-4" />} label="Drive" />
            <PermissionItem icon={<Users className="size-4" />} label="Contacts" />
          </div>
          {googleConnected ? (
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href={`/client-area/connections?clientId=${client.id}`}>
                Voir mes connexions <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full" size="lg">
              <Link
                href={`/api/oauth/google/start-public?clientId=${client.id}&returnTo=/onboarding`}
              >
                Connecter Google maintenant <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-5" />
            Étape 2 — Enregistre ton numéro WhatsApp
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
            Étape 3 — Envoie-lui ton premier message
          </CardTitle>
          <CardDescription>
            Pas de syntaxe particulière. Parle-lui normalement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <ExampleMessage>Lis mes 5 derniers emails et résume</ExampleMessage>
            <ExampleMessage>Note un RDV demain 14h avec Marc</ExampleMessage>
            <ExampleMessage>Trouve le devis de Mme Dupond dans mon Drive</ExampleMessage>
            <ExampleMessage>Envoie un mail à thomas@x.fr pour confirmer</ExampleMessage>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="size-5" />
            Étape 4 — Accède à ton espace
          </CardTitle>
          <CardDescription>
            Stats, historique, gestion des connexions, planification de tournées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" size="lg" variant="outline">
            <Link href={`/client-area?clientId=${client.id}`}>
              Aller à mon espace client <ArrowRight className="size-4" />
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

function PermissionItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
