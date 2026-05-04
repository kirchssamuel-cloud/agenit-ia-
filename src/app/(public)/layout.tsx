import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <Link href="/landing" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="text-sm font-semibold">Agent Platform</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/landing#modules">Modules</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Connexion</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Commencer gratuitement</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-8 text-xs text-muted-foreground">
          <span>Agent Platform · Ton agent IA personnel sur WhatsApp</span>
          <div className="flex gap-3">
            <Link href="/landing">Accueil</Link>
            <Link href="/signup">Inscription</Link>
            <Link href="/login">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
