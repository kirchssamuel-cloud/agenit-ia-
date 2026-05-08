"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  EyeOff,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  resetModuleOverrideAction,
  saveModulePriceAction,
  toggleModuleEnabledAction,
} from "./actions";

interface ModuleEditorView {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  status: string;
  defaultMonthlyEUR: number;
  monthlyEUR: number;
  hasCustomPrice: boolean;
  enabled: boolean;
  usedBy: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  leads: "Leads",
  scheduling: "Planning",
  communication: "Communication",
  accounting: "Comptabilité",
  documents: "Documents",
  other: "Autres",
};

export function ModulesEditor({ modules }: { modules: ModuleEditorView[] }) {
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>(
    Object.fromEntries(modules.map((m) => [m.id, String(m.monthlyEUR)])),
  );
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(
    Object.fromEntries(modules.map((m) => [m.id, m.enabled])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /** Total mensuel "vue client" si un client cochait tous les modules visibles */
  const previewTotal = useMemo(() => {
    return modules
      .filter((m) => enabledMap[m.id])
      .reduce((sum, m) => sum + Number(draftPrices[m.id] || 0), 0);
  }, [modules, draftPrices, enabledMap]);

  const visibleCount = useMemo(
    () => modules.filter((m) => enabledMap[m.id]).length,
    [modules, enabledMap],
  );

  const handleSavePrice = (id: string) => {
    setSavingId(id);
    const value = draftPrices[id] ?? "";
    startTransition(async () => {
      const res = await saveModulePriceAction(id, value);
      setSavingId(null);
      if (res.ok) toast.success("Prix mis à jour");
      else toast.error(res.error ?? "Erreur");
    });
  };

  const handleToggle = (id: string, next: boolean) => {
    setEnabledMap((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      const res = await toggleModuleEnabledAction(id, next);
      if (!res.ok) {
        // rollback
        setEnabledMap((prev) => ({ ...prev, [id]: !next }));
        toast.error(res.error ?? "Erreur");
      } else {
        toast.success(next ? "Module activé pour les clients" : "Module masqué");
      }
    });
  };

  const handleReset = (id: string) => {
    setSavingId(id);
    startTransition(async () => {
      const res = await resetModuleOverrideAction(id);
      setSavingId(null);
      if (res.ok) {
        toast.success("Réinitialisé");
        // on recharge en soft reload : laisse Next revalidatePath réafficher les valeurs serveur
        const m = modules.find((x) => x.id === id);
        if (m) {
          setDraftPrices((prev) => ({ ...prev, [id]: String(m.defaultMonthlyEUR) }));
          setEnabledMap((prev) => ({ ...prev, [id]: true }));
        }
      } else {
        toast.error(res.error ?? "Erreur");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Bandeau preview "vue client" */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Aperçu côté client
            </span>
            <span className="text-base font-semibold">
              {visibleCount} module{visibleCount > 1 ? "s" : ""} visible
              {visibleCount > 1 ? "s" : ""} sur la page d&apos;inscription
            </span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Si le client coche tout
            </span>
            <span className="text-2xl font-bold">{previewTotal} €/mois</span>
          </div>
        </CardContent>
      </Card>

      {/* Liste éditable des modules */}
      <div className="grid gap-4 lg:grid-cols-2">
        {modules.map((m) => {
          const isSaving = savingId === m.id;
          const draft = draftPrices[m.id] ?? "";
          const enabled = enabledMap[m.id] ?? true;
          const draftPriceNum = Number(draft || 0);
          const isPriceDirty = draftPriceNum !== m.monthlyEUR;
          const showsCustomBadge = m.hasCustomPrice || isPriceDirty;
          return (
            <Card
              key={m.id}
              className={cn("transition", !enabled && "opacity-60")}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg">{m.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {m.shortDescription}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant={m.status === "stable" ? "default" : "outline"}
                    >
                      {m.status}
                    </Badge>
                    {showsCustomBadge ? (
                      <Badge variant="outline" className="text-xs">
                        Prix custom
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </Badge>
                  <span>
                    {m.usedBy} client{m.usedBy > 1 ? "s" : ""} actif
                    {m.usedBy > 1 ? "s" : ""}
                  </span>
                  <span className="ml-auto">Défaut : {m.defaultMonthlyEUR} €</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Champ prix */}
                <div className="grid gap-1.5">
                  <Label htmlFor={`price-${m.id}`}>Prix mensuel (€)</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`price-${m.id}`}
                        type="number"
                        min={0}
                        step={1}
                        value={draft}
                        onChange={(e) =>
                          setDraftPrices((prev) => ({
                            ...prev,
                            [m.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSavePrice(m.id);
                        }}
                        className="pr-10"
                        disabled={isSaving}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        €
                      </span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleSavePrice(m.id)}
                      disabled={!isPriceDirty || isSaving}
                      size="sm"
                    >
                      {isSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="size-4" /> Enregistrer
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Switch visibilité client */}
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-start gap-3">
                    {enabled ? (
                      <Check className="mt-0.5 size-4 text-primary" />
                    ) : (
                      <EyeOff className="mt-0.5 size-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        Visible pour les nouveaux clients
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {enabled
                          ? "Apparaît dans /choose-modules et la landing"
                          : "Masqué — les clients ne peuvent pas le voir"}
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => handleToggle(m.id, v)}
                  />
                </div>

                {/* Reset */}
                {showsCustomBadge || !enabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReset(m.id)}
                    disabled={isSaving}
                    className="self-start text-xs"
                  >
                    <RotateCcw className="size-3.5" />
                    Réinitialiser aux valeurs par défaut
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
