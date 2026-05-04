"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export function ChooseModulesForm({ modules }: { modules: ModuleOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
                <div className="flex flex-col gap-1">
                  <Badge variant="outline">
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </Badge>
                </div>
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

      <Card className="sticky bottom-6 border-primary">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {selected.size} module{selected.size > 1 ? "s" : ""} sélectionné
              {selected.size > 1 ? "s" : ""}
            </span>
            <span className="text-2xl font-bold">{total} €/mois</span>
          </div>
          <Button asChild size="lg" disabled={selected.size === 0}>
            <Link
              href={
                selected.size === 0
                  ? "#"
                  : `/checkout?modules=${Array.from(selected).join(",")}`
              }
            >
              Aller au paiement <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
