"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { activateModulesAction } from "./actions";

interface ModuleOption {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  monthlyEUR: number;
  category: string;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  leads: "Leads",
  scheduling: "Planning",
  communication: "Communication",
  accounting: "Comptabilité",
  documents: "Documents",
  other: "Autres",
};

export function ChooseModulesForm({
  modules,
  clientId,
}: {
  modules: ModuleOption[];
  clientId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = modules
    .filter((m) => selected.has(m.id))
    .reduce((sum, m) => sum + m.monthlyEUR, 0);

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setError(null);
    const fd = new FormData();
    fd.append("clientId", clientId);
    fd.append("moduleIds", Array.from(selected).join(","));
    startTransition(async () => {
      const res = await activateModulesAction(fd);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2">
        {modules.map((m) => {
          const isSelected = selected.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-5 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline">
                  {CATEGORY_LABELS[m.category] ?? m.category}
                </Badge>
                <div
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {isSelected ? <Check className="size-3.5" /> : null}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold">{m.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {m.shortDescription}
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <span className="text-2xl font-bold">{m.monthlyEUR} €</span>
                <span className="text-sm text-muted-foreground">/mois</span>
              </div>
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="sticky bottom-6 border-primary">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {selected.size} module{selected.size > 1 ? "s" : ""} sélectionné
              {selected.size > 1 ? "s" : ""}
            </span>
            <span className="text-2xl font-bold">{total} €/mois</span>
          </div>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={selected.size === 0 || pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Activation...
              </>
            ) : (
              <>
                Aller au paiement <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
