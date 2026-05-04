"use client";

import { useState, useTransition } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accès réservé. Connecte-toi avec ton email et mot de passe admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const res = await loginAction(formData);
              if (res?.error) setError(res.error);
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error ? (
            <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</div>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Connexion...
              </>
            ) : (
              <>
                <LogIn className="size-4" /> Se connecter
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
