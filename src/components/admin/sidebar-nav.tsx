"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Users, Wrench, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/modules", label: "Modules vendus", icon: Boxes },
  { href: "/tools", label: "Compétences (tools)", icon: Wrench },
  { href: "/playground", label: "Playground", icon: PlayCircle },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
