import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Zap,
  Brain,
  MessageCircle,
  Workflow,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODULE_REGISTRY } from "@/modules/registry";

export default function LandingPage() {
  const modules = MODULE_REGISTRY.filter((m) => m.status !== "archived" as never);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(120,119,198,0.15),transparent)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center">
          <Badge variant="outline" className="gap-1.5">
            <Sparkles className="size-3" />
            Nouvelle génération d&apos;assistants IA
          </Badge>
          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            Ton assistant IA personnel,{" "}
            <span className="text-primary">directement sur WhatsApp.</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Un seul numéro à enregistrer. Ton agent répond à tes clients, génère tes
            devis, range tes tickets de caisse et organise tes plannings. Pendant
            que tu travailles ton métier.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Commencer gratuitement <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#modules">Voir les modules</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pas de carte bleue requise · Annulable à tout moment
          </p>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">
            3 étapes pour transformer ta boîte
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: <Workflow className="size-6" />,
                title: "1. Tu choisis tes modules",
                desc: "Devis, planning, compta, leads… Tu prends ce dont tu as besoin. Tu paies seulement ce que tu utilises.",
              },
              {
                icon: <MessageCircle className="size-6" />,
                title: "2. Tu enregistres le numéro",
                desc: "Un numéro WhatsApp dédié pour ton agent. Tu écris, il fait. Aucune app à installer.",
              },
              {
                icon: <Brain className="size-6" />,
                title: "3. Il apprend de toi",
                desc: "Plus tu l'utilises, plus il s'améliore. Il mémorise tes préférences, tes clients, tes tarifs.",
              },
            ].map((step) => (
              <Card key={step.title}>
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="border-b border-border py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Catalogue de modules</h2>
            <p className="mt-2 text-muted-foreground">
              Chaque module est une compétence que ton agent maîtrise. Active ce
              dont tu as besoin.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <Icon className="size-5" />
                      </div>
                      {m.status === "alpha" ? (
                        <Badge variant="outline">Alpha</Badge>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-semibold">{m.name}</h3>
                    <p className="flex-1 text-sm text-muted-foreground">
                      {m.shortDescription}
                    </p>
                    <div className="flex items-end justify-between border-t border-border pt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">
                          {m.pricing?.monthlyEUR ?? "—"}
                        </span>
                        <span className="text-sm text-muted-foreground">€/mois</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pourquoi */}
      <section className="border-b border-border py-20">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-bold">Pourquoi nous</h2>
            <p className="text-muted-foreground">
              Tu n&apos;as pas besoin d&apos;un site web compliqué. Tu utilises déjà
              WhatsApp toute la journée. On y a mis ton assistant.
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              <Bullet>Aucune app à télécharger, c&apos;est WhatsApp</Bullet>
              <Bullet>Ton agent comprend le langage naturel</Bullet>
              <Bullet>Mémoire persistante : il connaît tes habitudes</Bullet>
              <Bullet>Validation par un superviseur IA avant chaque action sensible</Bullet>
              <Bullet>Tu peux lui apprendre de nouvelles compétences en temps réel</Bullet>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <Card>
              <CardContent className="flex flex-col gap-3 p-6">
                <Zap className="size-6 text-amber-400" />
                <h3 className="font-semibold">Démarrage en 5 minutes</h3>
                <p className="text-sm text-muted-foreground">
                  Tu choisis tes modules, tu enregistres le numéro, et c&apos;est parti.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-3 p-6">
                <Receipt className="size-6 text-emerald-400" />
                <h3 className="font-semibold">Tarification transparente</h3>
                <p className="text-sm text-muted-foreground">
                  Prix par module, pas de surprise. Annulable à tout moment.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-4xl font-bold">Prêt à déléguer le boulot répétitif ?</h2>
          <p className="text-lg text-muted-foreground">
            5 minutes pour créer ton compte. Un numéro WhatsApp dédié activé tout
            de suite après le paiement.
          </p>
          <Button asChild size="lg">
            <Link href="/signup">
              Créer mon compte <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-500" />
      <span>{children}</span>
    </li>
  );
}
