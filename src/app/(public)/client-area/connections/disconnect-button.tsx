"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

interface Props {
  clientId: string;
  provider: string;
}

export function DisconnectButton({ clientId, provider }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleConfirm() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/integrations/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, provider }),
        });
        if (!res.ok) throw new Error("Disconnect failed");
        router.replace(
          `/client-area/connections?clientId=${clientId}&status=disconnected&provider=${provider}`,
        );
        router.refresh();
      } catch {
        router.replace(
          `/client-area/connections?clientId=${clientId}&status=error`,
        );
        router.refresh();
      } finally {
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 hover:bg-red-500/20 text-sm font-medium transition-colors"
      >
        Déconnecter
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
      >
        {isPending && <Loader2 size={14} className="animate-spin" />}
        Confirmer
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="p-2 text-slate-400 hover:text-white rounded-lg"
        aria-label="Annuler"
      >
        <X size={16} />
      </button>
    </div>
  );
}
