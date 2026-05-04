"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { createClientAction } from "./actions";

export function NewClientDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nouveau client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(formData: FormData) =>
            startTransition(async () => {
              const res = await createClientAction(formData);
              if (res.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Client créé");
              setOpen(false);
            })
          }
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>
              Ajoutez un client. Vous pourrez ensuite lui attribuer des modules.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nom de l&apos;entreprise</Label>
              <Input id="name" name="name" required placeholder="Solaris Énergie" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contactEmail">Email de contact</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                required
                placeholder="contact@..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="contactPhone">Téléphone</Label>
                <Input id="contactPhone" name="contactPhone" placeholder="+33 ..." />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="industry">Secteur</Label>
                <Input id="industry" name="industry" placeholder="Régie panneaux solaires" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Pilote, contact direct, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
