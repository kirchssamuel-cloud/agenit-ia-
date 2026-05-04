import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Créer ton compte</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          1 minute pour t&apos;inscrire. Pas de carte bleue requise.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>
            On te fait choisir tes modules juste après.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" action="/choose-modules">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nom complet</Label>
              <Input id="name" name="name" required placeholder="Samuel Kirchs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email pro</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="toi@entreprise.fr"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="company">Entreprise</Label>
                <Input id="company" name="company" required placeholder="Solaris" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="industry">Secteur</Label>
                <Input
                  id="industry"
                  name="industry"
                  placeholder="Régie panneaux solaires"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+33 6 12 34 56 78"
              />
              <span className="text-xs text-muted-foreground">
                Numéro où tu utilises WhatsApp.
              </span>
            </div>
            <Button type="submit" className="w-full">
              Continuer <ArrowRight className="size-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              En créant un compte, tu acceptes nos CGU.
            </p>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
