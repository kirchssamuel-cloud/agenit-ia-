import Link from "next/link";
import { Lock, ArrowRight, ShieldCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MODULE_REGISTRY, getModuleById } from "@/modules/registry";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ modules?: string }>;
}) {
  const params = await searchParams;
  const ids = (params.modules ?? "").split(",").filter(Boolean);
  const selectedModules = ids
    .map((id) => getModuleById(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  if (selectedModules.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-12 text-center">
        <h1 className="text-2xl font-bold">Aucun module sélectionné</h1>
        <p className="text-sm text-muted-foreground">
          Retourne sur la page de choix pour sélectionner tes modules.
        </p>
        <Button asChild>
          <Link href="/choose-modules">Choisir mes modules</Link>
        </Button>
      </div>
    );
  }

  const total = selectedModules.reduce(
    (s, m) => s + (m.pricing?.monthlyEUR ?? 0),
    0,
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[1fr_400px]">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Paiement</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            On utilise Stripe pour le paiement. Annulable à tout moment.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" />
              Carte bancaire
            </CardTitle>
            <CardDescription>
              💡 Démo UI : Stripe sera branché ici (StripeElements ou Checkout
              redirect).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" action="/onboarding">
              <div className="grid gap-1.5">
                <Label htmlFor="cardName">Nom sur la carte</Label>
                <Input id="cardName" placeholder="Samuel Kirchs" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cardNumber">Numéro de carte</Label>
                <Input
                  id="cardNumber"
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="exp">Expiration</Label>
                  <Input id="exp" placeholder="MM/AA" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" placeholder="123" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full">
                <Lock className="size-4" /> Payer {total} €/mois
              </Button>
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" /> Paiement sécurisé · SSL ·
                3D Secure
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Récap</CardTitle>
          <CardDescription>Tes modules choisis</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selectedModules.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{m.name}</span>
                <Badge variant="outline" className="mt-1 w-fit">
                  {m.status}
                </Badge>
              </div>
              <span className="text-sm font-semibold">
                {m.pricing?.monthlyEUR ?? 0} €
              </span>
            </div>
          ))}
          <div className="mt-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sous-total</span>
              <span>{total} €/mois</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">TVA (20%)</span>
              <span>{Math.round(total * 0.2)} €/mois</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">
                {total + Math.round(total * 0.2)} €/mois
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
