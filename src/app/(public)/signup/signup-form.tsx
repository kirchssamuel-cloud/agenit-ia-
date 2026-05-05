"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "./actions";

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData: FormData) => {
        setError(null);
        startTransition(async () => {
          const res = await signupAction(formData);
          if (res?.error) setError(res.error);
        });
      }}
      className="flex flex-col gap-4"
    >
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
      {error ? (
        <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Création...
          </>
        ) : (
          <>
            Continuer <ArrowRight className="size-4" />
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        En créant un compte, tu acceptes nos CGU.
      </p>
    </form>
  );
}
