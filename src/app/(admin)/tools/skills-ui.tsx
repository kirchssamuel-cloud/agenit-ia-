"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GraduationCap,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  resetInstructionAction,
  saveInstructionAction,
} from "./actions";

interface ToolView {
  id: string;
  name: string;
  description: string;
  exposedToLLM: boolean;
  usedByModules: string[];
}

interface SkillView {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  uiColor: string;
  useCases: string[];
  tools: ToolView[];
  instructionText: string;
  isCustomized: boolean;
  defaultInstructions: string;
  updatedAt: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  data: "Données",
  communication: "Communication",
  integration: "Intégration",
  utility: "Utilitaire",
  core: "Core",
};

export function SkillsUI({ skills }: { skills: SkillView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
  };

  const totalTools = skills.reduce((s, x) => s + x.tools.length, 0);
  const customizedCount = skills.filter((s) => s.isCustomized).length;

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <header className="flex flex-wrap items-center gap-4 rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
        <div className="flex size-12 items-center justify-center rounded-[16px] gradient-kizzo glow-orange-strong">
          <GraduationCap className="size-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Compétences de l&apos;agent
          </h1>
          <p className="text-sm text-muted-foreground">
            {skills.length} dossiers de compétences · {totalTools} tools sous-jacents · {customizedCount} personnalisé{customizedCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="ml-auto rounded-full bg-primary/10 px-4 py-2 text-xs text-primary">
          ✨ Clique un dossier pour apprendre à l&apos;agent
        </div>
      </header>

      {/* GRILLE DOSSIERS */}
      <div className="grid gap-4 lg:grid-cols-2">
        {skills.map((s) => {
          const isOpen = openId === s.id;
          return (
            <SkillCard
              key={s.id}
              skill={s}
              isOpen={isOpen}
              onToggle={() => toggle(s.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SkillCard — un dossier de compétence
// ============================================================

function SkillCard({
  skill,
  isOpen,
  onToggle,
}: {
  skill: SkillView;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border bg-card/40 backdrop-blur transition-all",
        isOpen ? "border-primary/50 glow-orange" : "border-border hover:border-primary/30",
        skill.uiColor,
      )}
    >
      {/* Header cliquable */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-background/60 text-2xl">
          {skill.emoji}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-lg font-semibold">{skill.name}</h3>
            {skill.isCustomized ? (
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
                personnalisé
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {skill.description}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-background/60 px-2 py-0.5">
              {CATEGORY_LABELS[skill.category] ?? skill.category}
            </span>
            <span className="flex items-center gap-1">
              <Wrench className="size-3" />
              {skill.tools.length} tool{skill.tools.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground">
          {isOpen ? (
            <FolderOpen className="size-5 text-primary" />
          ) : (
            <Folder className="size-5" />
          )}
          {isOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
      </button>

      {/* Contenu déplié */}
      {isOpen ? (
        <div className="flex flex-col gap-5 border-t border-border px-5 pb-5 pt-4 animate-slide-in-up">
          {/* Cas d'usage */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5" />
              Cas d&apos;usage typiques
            </h4>
            <ul className="flex flex-col gap-1.5 text-xs text-foreground/80">
              {skill.useCases.map((u, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  {u}
                </li>
              ))}
            </ul>
          </section>

          {/* Tools sous-jacents (compact) */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Wrench className="size-3.5" />
              Tools sous-jacents ({skill.tools.length})
            </h4>
            <div className="flex flex-col gap-2">
              {skill.tools.map((t) => (
                <div
                  key={t.id}
                  className="rounded-[12px] border border-border bg-background/40 p-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <code className="font-mono text-[11px] text-primary">
                      {t.id}
                    </code>
                    {!t.exposedToLLM ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                        interne
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.description}
                  </p>
                  {t.usedByModules.length > 0 ? (
                    <div className="mt-1 text-[10px] text-muted-foreground/70">
                      Utilisé par : {t.usedByModules.join(", ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Apprends-moi (zone instructions) */}
          <InstructionsEditor skill={skill} />
        </div>
      ) : null}
    </div>
  );
}

// ============================================================
// InstructionsEditor — la zone "apprends à l'agent"
// ============================================================

function InstructionsEditor({ skill }: { skill: SkillView }) {
  const [text, setText] = useState(skill.instructionText);
  const [pending, startTransition] = useTransition();

  const isDirty = text !== skill.instructionText;

  const handleSave = () => {
    startTransition(async () => {
      const r = await saveInstructionAction(skill.id, text);
      if (r.ok) toast.success("Instructions sauvegardées");
      else toast.error(r.error ?? "Erreur");
    });
  };

  const handleReset = () => {
    if (!confirm("Revenir aux instructions par défaut ?")) return;
    startTransition(async () => {
      const r = await resetInstructionAction(skill.id);
      if (r.ok) {
        setText(skill.defaultInstructions);
        toast.success("Réinitialisé");
      } else {
        toast.error(r.error ?? "Erreur");
      }
    });
  };

  return (
    <section className="rounded-[16px] border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-heading text-sm font-semibold text-primary">
          <GraduationCap className="size-4" />
          Apprends à l&apos;agent
        </h4>
        {skill.updatedAt ? (
          <span className="text-[10px] text-muted-foreground">
            modifié le {new Date(skill.updatedAt).toLocaleString("fr-FR")}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Écris ici comment tu veux que l&apos;agent utilise cette compétence.
        Tes instructions seront injectées dans le system prompt à chaque message.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        disabled={pending}
        placeholder="Ex: Toujours valider la marge avant d'envoyer un devis. Marge minimum: 25%."
        className="w-full rounded-[12px] border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-primary focus:outline-none focus:glow-orange disabled:opacity-50"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || pending}
          className="flex items-center gap-2 rounded-[14px] bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 hover:glow-orange-strong disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Save className="size-3.5" />
              Enregistrer
            </>
          )}
        </button>
        {skill.isCustomized ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="flex items-center gap-2 rounded-[14px] border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-primary hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" />
            Réinitialiser
          </button>
        ) : null}
        {isDirty ? (
          <span className="ml-auto text-[10px] text-primary">
            ● Modifications non sauvées
          </span>
        ) : null}
      </div>
    </section>
  );
}
