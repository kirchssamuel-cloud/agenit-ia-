"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Boxes,
  Wrench,
  GraduationCap,
  TrendingUp,
  ScrollText,
  Receipt,
  PlayCircle,
  Bot,
  MessageCircle,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
}

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Pilotage" },
  { href: "/clients", label: "Clients", icon: Users, group: "Pilotage" },
  { href: "/billing", label: "Facturation", icon: Receipt, group: "Pilotage" },

  { href: "/modules", label: "Modules & Prix", icon: Boxes, group: "Catalogue" },
  { href: "/tools", label: "Compétences", icon: Wrench, group: "Catalogue" },
  { href: "/whatsapp", label: "Pool WhatsApp", icon: MessageCircle, group: "Catalogue" },

  { href: "/agent-demo", label: "Démo Agent (chat)", icon: Bot, group: "Intelligence" },
  { href: "/testing", label: "Évaluation Agent", icon: Target, group: "Intelligence" },
  { href: "/education", label: "Éducation Agent", icon: GraduationCap, group: "Intelligence" },
  { href: "/performance", label: "Performance Agent", icon: TrendingUp, group: "Intelligence" },
  { href: "/logs", label: "Logs & Conversations", icon: ScrollText, group: "Intelligence" },
  { href: "/playground", label: "Playground (modules)", icon: PlayCircle, group: "Intelligence" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const groups = Array.from(new Set(items.map((i) => i.group ?? "")));
  return (
    <nav className="flex flex-col gap-3 px-3 py-2">
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          {group ? (
            <span className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </span>
          ) : null}
          {items
            .filter((i) => (i.group ?? "") === group)
            .map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
