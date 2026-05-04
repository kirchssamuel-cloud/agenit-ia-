"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleClientModuleAction } from "../actions";

export function ModuleToggle({
  clientId,
  moduleId,
  initialEnabled,
}: {
  clientId: string;
  moduleId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={enabled}
      disabled={pending}
      onCheckedChange={(next) => {
        setEnabled(next);
        startTransition(async () => {
          const res = await toggleClientModuleAction(clientId, moduleId, next);
          if (res.error) {
            toast.error(res.error);
            setEnabled(!next);
            return;
          }
          toast.success(next ? "Module activé" : "Module désactivé");
        });
      }}
    />
  );
}
