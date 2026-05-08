"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  importNumberAction,
  manualAssignAction,
  releaseNumberAction,
  setStatusAction,
} from "./actions";
import type { WhatsAppNumberStatus } from "@/lib/db/whatsapp";

interface NumberRow {
  id: string;
  phoneNumber: string;
  status: WhatsAppNumberStatus;
  twilioSid: string | null;
  clientId: string | null;
  clientName: string | null;
  monthlyCostCents: number | null;
  countryCode: string;
  notes: string | null;
  assignedAt: string | null;
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  available: number;
  assigned: number;
  suspended: number;
}

export function WhatsAppPoolUI({
  numbers,
  clients,
  stats,
}: {
  numbers: NumberRow[];
  clients: ClientOption[];
  stats: Stats;
}) {
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRelease = (id: string, phone: string) => {
    if (!confirm(`Libérer le numéro ${phone} (le retirer du client) ?`)) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await releaseNumberAction(id);
      setBusyId(null);
      if (r.ok) toast.success(`${phone} libéré`);
      else toast.error(r.error ?? "Erreur");
    });
  };

  const handleStatus = (id: string, status: WhatsAppNumberStatus) => {
    setBusyId(id);
    startTransition(async () => {
      const r = await setStatusAction(id, status);
      setBusyId(null);
      if (r.ok) toast.success(`Statut → ${status}`);
      else toast.error(r.error ?? "Erreur");
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <header className="flex flex-wrap items-center gap-4 rounded-[20px] border border-border bg-card/40 p-5 backdrop-blur">
        <div className="flex size-12 items-center justify-center rounded-[16px] gradient-kizzo glow-orange-strong">
          <MessageCircle className="size-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Pool WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Numéros Twilio attribués aux clients pour leur agent IA WhatsApp
          </p>
        </div>
      </header>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} color="muted" />
        <StatCard label="Libres" value={stats.available} color="primary" />
        <StatCard label="Attribués" value={stats.assigned} color="secondary" />
        <StatCard
          label="Suspendus"
          value={stats.suspended}
          color="destructive"
        />
      </div>

      {/* IMPORT NUMÉRO */}
      <section className="rounded-[20px] border border-border bg-card/40 p-6 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <h2 className="font-heading text-lg font-semibold">
            Importer un numéro
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Achète un numéro WhatsApp Business sur{" "}
          <a
            href="https://console.twilio.com/us1/develop/phone-numbers/manage/search"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:brightness-125"
          >
            Twilio Console
          </a>{" "}
          puis colle-le ici (format E.164 : +33712345601).
        </p>
        <ImportForm />
      </section>

      {/* ATTRIBUTION MANUELLE */}
      {clients.length > 0 ? (
        <section className="rounded-[20px] border border-border bg-card/40 p-6 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="size-4 text-secondary" />
            <h2 className="font-heading text-lg font-semibold">
              Attribution manuelle
            </h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Normalement c&apos;est automatique après paiement. Ici tu peux
            forcer l&apos;attribution d&apos;un numéro libre à un client.
          </p>
          <ManualAssignForm clients={clients} />
        </section>
      ) : null}

      {/* LISTE DES NUMÉROS */}
      <section className="rounded-[20px] border border-border bg-card/40 backdrop-blur">
        <div className="border-b border-border p-5">
          <h2 className="font-heading text-lg font-semibold">
            Pool ({numbers.length} numéros)
          </h2>
        </div>
        {numbers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <Sparkles className="size-8 text-muted-foreground/40" />
            <p>Aucun numéro dans le pool. Importe-en un ci-dessus.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Numéro</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Twilio SID</th>
                  <th className="px-5 py-3 font-medium">Coût</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-border/50 hover:bg-background/30"
                  >
                    <td className="px-5 py-3 font-mono text-foreground">
                      {n.phoneNumber}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={n.status} />
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      {n.clientName ?? (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {n.twilioSid ? (
                        n.twilioSid.slice(0, 14) + "…"
                      ) : (
                        <span className="text-muted-foreground/40">démo</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {n.monthlyCostCents !== null
                        ? `${(n.monthlyCostCents / 100).toFixed(2)} €/mo`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {n.status === "assigned" ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleRelease(n.id, n.phoneNumber)
                            }
                            disabled={busyId === n.id}
                            className="rounded-[12px] border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary hover:text-foreground disabled:opacity-40"
                          >
                            {busyId === n.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Libérer"
                            )}
                          </button>
                        ) : null}
                        {n.status !== "suspended" ? (
                          <button
                            type="button"
                            onClick={() => handleStatus(n.id, "suspended")}
                            disabled={busyId === n.id}
                            className="rounded-[12px] border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs text-destructive transition-all hover:border-destructive disabled:opacity-40"
                          >
                            <ShieldAlert className="inline size-3" /> Suspendre
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStatus(n.id, "available")}
                            disabled={busyId === n.id}
                            className="rounded-[12px] border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary transition-all hover:border-primary disabled:opacity-40"
                          >
                            <RefreshCw className="inline size-3" /> Réactiver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* INFOS DEPLOY */}
      <section className="rounded-[20px] border border-secondary/30 bg-secondary/5 p-5 text-sm">
        <h3 className="mb-2 flex items-center gap-2 font-heading font-semibold text-secondary">
          <Sparkles className="size-4" />
          Setup Twilio (à faire une fois)
        </h3>
        <ol className="ml-5 flex list-decimal flex-col gap-1 text-xs text-foreground/80">
          <li>
            Crée un compte Twilio sur{" "}
            <a
              href="https://www.twilio.com/try-twilio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              twilio.com/try-twilio
            </a>
          </li>
          <li>
            Active WhatsApp Business :{" "}
            <a
              href="https://console.twilio.com/us1/develop/sms/whatsapp/sandbox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              console.twilio.com/us1/develop/sms/whatsapp/sandbox
            </a>
          </li>
          <li>
            Récupère <code className="rounded bg-card px-1">Account SID</code>{" "}
            + <code className="rounded bg-card px-1">Auth Token</code> dans{" "}
            <a
              href="https://console.twilio.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Console
            </a>
          </li>
          <li>
            Ajoute-les en variables Vercel :{" "}
            <code className="rounded bg-card px-1">TWILIO_ACCOUNT_SID</code> +{" "}
            <code className="rounded bg-card px-1">TWILIO_AUTH_TOKEN</code>
          </li>
          <li>
            Configure le webhook dans Twilio (numéro WhatsApp → Messaging →
            Webhook URL) :
            <code className="ml-1 rounded bg-card px-1 font-mono text-[10px]">
              https://agenit-ia-spo6.vercel.app/api/webhooks/whatsapp
            </code>
          </li>
        </ol>
      </section>
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-heading text-3xl font-bold leading-none">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WhatsAppNumberStatus }) {
  const map = {
    available: {
      label: "Libre",
      classes: "bg-primary/15 text-primary border-primary/30",
    },
    assigned: {
      label: "Attribué",
      classes: "bg-secondary/15 text-secondary border-secondary/30",
    },
    suspended: {
      label: "Suspendu",
      classes: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };
  const m = map[status];
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider",
        m.classes,
      )}
    >
      {m.label}
    </span>
  );
}

function ImportForm() {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const r = await importNumberAction(fd);
          if (r.ok) toast.success("Numéro importé");
          else toast.error(r.error ?? "Erreur");
        });
      }}
      className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_2fr_auto]"
    >
      <input
        name="phoneNumber"
        required
        placeholder="+33712345601"
        className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:glow-orange"
      />
      <input
        name="twilioSid"
        placeholder="PNxxxxxxxxxxxxxxxx (optionnel)"
        className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:glow-orange"
      />
      <input
        name="monthlyCostCents"
        type="number"
        placeholder="100"
        title="Coût en cents (100 = 1€/mo)"
        className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:glow-orange"
      />
      <input
        name="notes"
        placeholder="Notes (optionnel)"
        className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:glow-orange"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[14px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 hover:glow-orange-strong disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Importer"}
      </button>
    </form>
  );
}

function ManualAssignForm({ clients }: { clients: ClientOption[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const r = await manualAssignAction(fd);
          if (r.ok) {
            toast.success(`Numéro ${r.phoneNumber} attribué`);
          } else {
            toast.error(r.error ?? "Erreur");
          }
        });
      }}
      className="grid gap-3 md:grid-cols-[2fr_2fr_auto]"
    >
      <select
        name="clientId"
        required
        className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:glow-orange"
      >
        <option value="">Sélectionne un client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id} className="bg-card">
            {c.name}
          </option>
        ))}
      </select>
      <input
        name="userPhone"
        placeholder="+336XXXXXXXX (téléphone perso, optionnel)"
        className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:glow-orange"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[14px] bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:brightness-110 disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Attribuer"}
      </button>
    </form>
  );
}
