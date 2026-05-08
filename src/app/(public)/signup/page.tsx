import Link from "next/link";
import { Check, MessageSquare, ShieldCheck, Sparkles, Zap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignupForm } from "./signup-form";

const BENEFITS = [
  {
    icon: MessageSquare,
    title: "Ton agent sur WhatsApp",
    text: "Un numéro dédié, accessible depuis ton téléphone pro.",
  },
  {
    icon: Zap,
    title: "Active uniquement ce dont tu as besoin",
    text: "Tu choisis tes modules, tu paies ce que tu utilises.",
  },
  {
    icon: ShieldCheck,
    title: "Modifiable à tout moment",
    text: "Ajoute ou retire un module en 1 clic depuis ton dashboard.",
  },
];

const STEPS = [
  { id: 1, label: "Inscription", current: true },
  { id: 2, label: "Choix des modules", current: false },
  { id: 3, label: "Paiement", current: false },
];

export default function SignupPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 md:grid-cols-[1fr_minmax(380px,440px)] md:gap-12">
      {/* Colonne gauche : value prop + steps */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Badge variant="outline" className="w-fit gap-2">
            <Sparkles className="size-3.5" /> Sans carte bleue
          </Badge>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Crée ton compte en{" "}
            <span className="text-primary">1 minute</span>
          </h1>
          <p className="text-base text-muted-foreground">
            On te fait choisir tes modules juste après. Tu ne paies qu&apos;à la fin.
          </p>
        </div>

        {/* Stepper */}
        <ol className="flex flex-col gap-2">
          {STEPS.map((s, idx) => (
            <li
              key={s.id}
              className="flex items-center gap-3 text-sm"
              aria-current={s.current ? "step" : undefined}
            >
              <div
                className={
                  s.current
                    ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
                    : idx < STEPS.findIndex((x) => x.current)
                      ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary"
                      : "flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
                }
              >
                {s.id}
              </div>
              <span
                className={
                  s.current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>

        {/* Bénéfices */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-5">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{b.title}</span>
                  <span className="text-sm text-muted-foreground">{b.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-3.5 text-primary" />
          Aucun engagement — résiliable à tout moment
        </p>
      </div>

      {/* Colonne droite : formulaire */}
      <div className="flex flex-col gap-4">
        <Card className="md:sticky md:top-20">
          <CardHeader>
            <CardTitle>Tes informations</CardTitle>
            <CardDescription>
              On te fait choisir tes modules juste après.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
