"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Play,
  PlayCircle,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  runAllDomainsAction,
  runDomainAction,
  updateGapStatusAction,
} from "./actions";
import type { AgentGap, TestResult } from "@/lib/db/test-bank-store";

interface DomainView {
  domain: string;
  name: string;
  emoji: string;
  questionCount: number;
  totalTests: number;
  passedTests: number;
  successRate: number | null;
  avgScore: number | null;
  openGapsCount: number;
  lastTested: string | null;
  trend: "improving" | "stable" | "declining" | null;
}

interface GlobalStats {
  totalDomains: number;
  totalQuestions: number;
  totalTested: number;
  totalPassed: number;
  globalSuccessRate: number | null;
  globalAvgScore: number | null;
  totalGapsOpen: number;
}

const GAP_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  missing_vocab: { label: "Vocabulaire manquant", emoji: "🔤" },
  missing_concept: { label: "Concept non couvert", emoji: "💭" },
  wrong_method: { label: "Méthode incorrecte", emoji: "❌" },
  incorrect_fact: { label: "Fait erroné", emoji: "🚫" },
  tone_mismatch: { label: "Ton inadapté", emoji: "🎭" },
  unknown: { label: "Autre", emoji: "❓" },
};

export function TestingDashboardUI({
  domains,
  gaps,
  recentResults,
  globalStats,
}: {
  domains: DomainView[];
  gaps: AgentGap[];
  recentResults: TestResult[];
  globalStats: GlobalStats;
}) {
  const [pending, startTransition] = useTransition();
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [busyGapId, setBusyGapId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "gaps" | "history">(
    "overview",
  );

  const runOne = (domain: string) => {
    setBusyDomain(domain);
    startTransition(async () => {
      const r = await runDomainAction(domain);
      setBusyDomain(null);
      if (r.ok) {
        toast.success(
          `${domain} : ${r.successRate?.toFixed(0)}% réussite (${r.avgScore?.toFixed(1)}/10)`,
        );
      } else {
        toast.error(r.error ?? "Erreur");
      }
    });
  };

  const runAll = () => {
    if (
      !confirm(
        `Lancer le test complet sur ${globalStats.totalDomains} domaines (${globalStats.totalQuestions} questions) ? Peut prendre quelques minutes et coûter quelques cents.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await runAllDomainsAction();
      if (r.ok) {
        toast.success(
          `Tests complets terminés : ${r.totalTests} questions sur ${r.totalDomains} domaines`,
        );
      } else {
        toast.error(r.error ?? "Erreur");
      }
    });
  };

  const fixGap = (gapId: string, status: "fixed" | "wontfix") => {
    setBusyGapId(gapId);
    startTransition(async () => {
      const r = await updateGapStatusAction(gapId, status);
      setBusyGapId(null);
      if (r.ok)
        toast.success(status === "fixed" ? "Gap résolu" : "Gap ignoré");
      else toast.error(r.error ?? "Erreur");
    });
  };

  // Top 3 forts / faibles
  const tested = domains.filter((d) => d.successRate !== null);
  const sorted = [...tested].sort(
    (a, b) => (b.successRate ?? 0) - (a.successRate ?? 0),
  );
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <header className="flex flex-wrap items-center gap-4 rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
        <div className="flex size-12 items-center justify-center rounded-[16px] gradient-kizzo glow-orange-strong">
          <Target className="size-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Évaluation Agent
          </h1>
          <p className="text-sm text-muted-foreground">
            {globalStats.totalDomains} domaines · {globalStats.totalQuestions}{" "}
            questions de référence · {globalStats.totalGapsOpen} lacunes ouvertes
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={runAll}
            disabled={pending}
            className="flex items-center gap-2 rounded-[16px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:glow-orange-strong disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Lancer tous les tests
          </button>
        </div>
      </header>

      {/* STATS GLOBALES */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Taux réussite global"
          value={
            globalStats.globalSuccessRate !== null
              ? `${globalStats.globalSuccessRate.toFixed(0)}%`
              : "—"
          }
          icon={CheckCircle2}
          color={
            globalStats.globalSuccessRate === null
              ? "muted"
              : globalStats.globalSuccessRate >= 80
                ? "primary"
                : globalStats.globalSuccessRate >= 60
                  ? "secondary"
                  : "destructive"
          }
        />
        <StatCard
          label="Score moyen"
          value={
            globalStats.globalAvgScore !== null
              ? `${globalStats.globalAvgScore.toFixed(1)}/10`
              : "—"
          }
          icon={Target}
          color="secondary"
        />
        <StatCard
          label="Questions testées"
          value={`${globalStats.totalTested}`}
          icon={Activity}
          color="muted"
        />
        <StatCard
          label="Lacunes ouvertes"
          value={globalStats.totalGapsOpen.toString()}
          icon={AlertTriangle}
          color={globalStats.totalGapsOpen > 0 ? "destructive" : "muted"}
        />
      </div>

      {/* TOP 3 / BOTTOM 3 */}
      {tested.length >= 2 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[20px] border border-emerald-500/30 bg-emerald-500/5 p-5">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="size-4" />
              Top domaines forts
            </h3>
            <ul className="flex flex-col gap-2">
              {top3.map((d) => (
                <li
                  key={d.domain}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {d.emoji} {d.name}
                  </span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {d.successRate?.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[20px] border border-destructive/30 bg-destructive/5 p-5">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wider text-destructive">
              <TrendingDown className="size-4" />
              Domaines à améliorer
            </h3>
            <ul className="flex flex-col gap-2">
              {bottom3.map((d) => (
                <li
                  key={d.domain}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {d.emoji} {d.name}
                  </span>
                  <span className="font-mono font-semibold text-destructive">
                    {d.successRate?.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* TABS */}
      <div className="flex gap-2 border-b border-border">
        <TabButton
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          label="Domaines"
          count={domains.length}
        />
        <TabButton
          active={activeTab === "gaps"}
          onClick={() => setActiveTab("gaps")}
          label="Lacunes"
          count={gaps.length}
        />
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          label="Historique"
          count={recentResults.length}
        />
      </div>

      {/* TAB CONTENT */}
      {activeTab === "overview" ? (
        <DomainsTable
          domains={domains}
          onRun={runOne}
          busyDomain={busyDomain}
        />
      ) : null}

      {activeTab === "gaps" ? (
        <GapsList
          gaps={gaps}
          onFix={fixGap}
          busyGapId={busyGapId}
        />
      ) : null}

      {activeTab === "history" ? (
        <HistoryTable results={recentResults} />
      ) : null}
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "primary" | "secondary" | "muted" | "destructive";
}) {
  const colorClasses = {
    primary: "border-primary/30 text-primary",
    secondary: "border-secondary/30 text-secondary",
    muted: "border-border text-foreground",
    destructive: "border-destructive/30 text-destructive",
  };
  return (
    <div
      className={cn(
        "rounded-[20px] border bg-card/40 p-5 backdrop-blur",
        colorClasses[color],
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className="size-5" />
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-heading text-2xl font-bold leading-none">
        {value}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-mono",
          active
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DomainsTable({
  domains,
  onRun,
  busyDomain,
}: {
  domains: DomainView[];
  onRun: (domain: string) => void;
  busyDomain: string | null;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-card/40 backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Domaine</th>
              <th className="px-5 py-3 text-center font-medium">Questions</th>
              <th className="px-5 py-3 text-center font-medium">Réussite</th>
              <th className="px-5 py-3 text-center font-medium">Score moy.</th>
              <th className="px-5 py-3 text-center font-medium">Lacunes</th>
              <th className="px-5 py-3 text-center font-medium">Tendance</th>
              <th className="px-5 py-3 text-center font-medium">Dernier run</th>
              <th className="px-5 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => {
              const successColor =
                d.successRate === null
                  ? "text-muted-foreground"
                  : d.successRate >= 80
                    ? "text-emerald-400"
                    : d.successRate >= 60
                      ? "text-amber-400"
                      : "text-destructive";
              return (
                <tr
                  key={d.domain}
                  className="border-b border-border/50 hover:bg-background/30"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{d.emoji}</span>
                      <span>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {d.domain}
                        </div>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center text-muted-foreground">
                    {d.questionCount}
                  </td>
                  <td
                    className={cn(
                      "px-5 py-3 text-center font-mono font-semibold",
                      successColor,
                    )}
                  >
                    {d.successRate !== null
                      ? `${d.successRate.toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-center font-mono">
                    {d.avgScore !== null ? `${d.avgScore.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {d.openGapsCount > 0 ? (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-mono text-destructive">
                        {d.openGapsCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {d.trend === "improving" ? (
                      <TrendingUp className="mx-auto size-4 text-emerald-400" />
                    ) : d.trend === "declining" ? (
                      <TrendingDown className="mx-auto size-4 text-destructive" />
                    ) : d.trend === "stable" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">·</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center text-xs text-muted-foreground">
                    {d.lastTested
                      ? new Date(d.lastTested).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "jamais"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRun(d.domain)}
                      disabled={busyDomain === d.domain}
                      className="inline-flex items-center gap-1.5 rounded-[12px] border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-40"
                    >
                      {busyDomain === d.domain ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Play className="size-3" />
                      )}
                      Run
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GapsList({
  gaps,
  onFix,
  busyGapId,
}: {
  gaps: AgentGap[];
  onFix: (gapId: string, status: "fixed" | "wontfix") => void;
  busyGapId: string | null;
}) {
  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[20px] border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="size-8 text-emerald-400" />
        <p className="font-heading">Aucune lacune ouverte 🎉</p>
        <p className="text-xs">
          Lance une suite de tests pour détecter d&apos;éventuelles lacunes.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {gaps.map((gap) => {
        const meta = GAP_TYPE_LABELS[gap.gapType] ?? GAP_TYPE_LABELS.unknown;
        return (
          <div
            key={gap.id}
            className="rounded-[20px] border border-destructive/30 bg-destructive/5 p-5"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{meta.emoji}</span>
              <span className="font-mono text-xs uppercase tracking-wider text-destructive">
                {meta.label}
              </span>
              <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-mono">
                {gap.domain}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {new Date(gap.createdAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <p className="text-sm text-foreground/90">{gap.description}</p>
            {gap.suggestedFix ? (
              <div className="mt-3 rounded-[14px] border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
                <strong className="text-primary">Suggestion : </strong>
                {gap.suggestedFix}
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onFix(gap.id, "fixed")}
                disabled={busyGapId === gap.id}
                className="flex items-center gap-1.5 rounded-[12px] border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-400 hover:border-emerald-500 disabled:opacity-40"
              >
                {busyGapId === gap.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3" />
                )}
                Marquer résolu
              </button>
              <button
                type="button"
                onClick={() => onFix(gap.id, "wontfix")}
                disabled={busyGapId === gap.id}
                className="flex items-center gap-1.5 rounded-[12px] border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40"
              >
                <XCircle className="size-3" />
                Won&apos;t fix
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTable({ results }: { results: TestResult[] }) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[20px] border border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
        <Clock className="size-8" />
        <p>Aucun test exécuté pour le moment.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {results.map((r) => (
        <details
          key={r.id}
          className="rounded-[20px] border border-border bg-card/40 backdrop-blur"
        >
          <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm">
            {r.passed ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {r.questionId}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-mono",
                r.passed
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {r.evaluatorScore?.toFixed(1) ?? "?"}/10
            </span>
            {r.executionTimeMs !== null ? (
              <span className="text-[10px] text-muted-foreground">
                {r.executionTimeMs}ms
              </span>
            ) : null}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {new Date(r.testedAt).toLocaleString("fr-FR")}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="border-t border-border p-4 text-xs">
            <div className="mb-2 text-muted-foreground">
              <strong className="text-foreground">Réponse agent :</strong>
              <p className="mt-1 whitespace-pre-wrap">
                {r.agentResponse.slice(0, 500)}
                {r.agentResponse.length > 500 ? "…" : ""}
              </p>
            </div>
            {r.evaluatorFeedback ? (
              <div className="mb-2 rounded-[12px] border border-secondary/30 bg-secondary/5 p-3">
                <strong className="text-secondary">Feedback :</strong>{" "}
                {r.evaluatorFeedback}
              </div>
            ) : null}
            {r.missingConcepts.length > 0 ? (
              <div className="mb-1">
                <strong>Concepts manquants :</strong>{" "}
                <span className="text-destructive">
                  {r.missingConcepts.join(", ")}
                </span>
              </div>
            ) : null}
            {r.missingKeywords.length > 0 ? (
              <div>
                <strong>Mots-clés manquants :</strong>{" "}
                <span className="text-destructive">
                  {r.missingKeywords.join(", ")}
                </span>
              </div>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}
