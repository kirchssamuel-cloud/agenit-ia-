import Link from "next/link";
import { Boxes, LayoutDashboard, Users, Sparkles, Wrench, PlayCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { SidebarNav } from "./sidebar-nav";

/** True si Supabase pas configuré (mode démo). */
function isSupabasePlaceholder(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    process.env.DEMO_MODE === "true" ||
    url.includes("placeholder") ||
    key.includes("placeholder") ||
    url === "" ||
    key === ""
  );
}

export async function AdminSidebar() {
  // Mode démo : pas de Supabase, on affiche la sidebar avec un email factice.
  let userEmail: string | null = "demo@agent-platform.local";
  if (!isSupabasePlaceholder()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  }
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-none">Agent Platform</span>
          <span className="text-xs text-muted-foreground">Console admin</span>
        </div>
      </div>
      <SidebarNav />
      <div className="mt-auto flex flex-col">
        <LogoutButton email={userEmail} />
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          v0.1.0 — alpha
        </div>
      </div>
    </aside>
  );
}

export function AdminTopbar({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-1 border-b border-border bg-background px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
        <LayoutDashboard className="size-5 text-muted-foreground" />
        {title}
      </h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

// Re-export Link so it stays used by SidebarNav siblings if any
export { Link };
