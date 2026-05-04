"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSkillAction } from "./actions";

interface ModuleOption {
  id: string;
  name: string;
}

export function NewSkillDialog({ modules }: { modules: ModuleOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Apprendre une compétence
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const r = await createSkillAction(formData);
              if (r.error) {
                toast.error(r.error);
                return;
              }
              toast.success("Compétence enseignée à l'agent");
              setOpen(false);
            })
          }
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Apprendre une nouvelle compétence à l&apos;agent</DialogTitle>
            <DialogDescription>
              Décris quand l&apos;agent doit la déclencher et ce qu&apos;il doit faire.
              Tu peux ajouter des exemples de conversation pour qu&apos;il apprenne par
              imitation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nom de la compétence</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="ex : Génération devis carrelage"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">Description courte</Label>
              <Input
                id="description"
                name="description"
                placeholder="À quoi sert cette compétence en une phrase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="moduleId">Module lié (optionnel)</Label>
                <select
                  id="moduleId"
                  name="moduleId"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">— Aucun —</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="triggerPattern">
                  Quand déclencher ? (mots-clés / pattern)
                </Label>
                <Input
                  id="triggerPattern"
                  name="triggerPattern"
                  placeholder='ex : "devis", "estimation", "combien ça coûte"'
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="actionTemplate">Que doit faire l&apos;agent ?</Label>
              <textarea
                id="actionTemplate"
                name="actionTemplate"
                rows={3}
                className="rounded-md border border-input bg-transparent p-3 text-sm"
                placeholder="ex : Demander la surface en m², le type de carrelage, puis générer un devis avec marge X%."
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="examples">
                Exemples de conversation (JSON — optionnel)
              </Label>
              <textarea
                id="examples"
                name="examples"
                rows={6}
                className="rounded-md border border-input bg-transparent p-3 font-mono text-xs"
                placeholder={`[
  { "user": "Devis 100m² carrelage", "agent": "Quel type de carrelage ?" },
  { "user": "Carrelage marbre", "agent": "Voici le devis : ..." }
]`}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Enseigner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
