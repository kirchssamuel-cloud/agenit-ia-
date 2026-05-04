"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { logoutAction } from "@/app/login/actions";

export function LogoutButton({ email }: { email: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={() => startTransition(async () => { await logoutAction(); })}
      className="flex flex-col gap-2 px-3 pb-3"
    >
      {email ? (
        <span className="px-2 text-xs text-muted-foreground truncate" title={email}>
          {email}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        Déconnexion
      </button>
    </form>
  );
}
