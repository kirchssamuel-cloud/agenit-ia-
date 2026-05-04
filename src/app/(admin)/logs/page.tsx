import { ScrollText, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import Link from "next/link";
import { AdminTopbar } from "@/components/admin/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRecentRuns } from "@/lib/db/runs";
import { ensureLoaded, listClients } from "@/lib/db/store";
import { getModuleById } from "@/modules/registry";

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; status?: string }>;
}) {
  await ensureLoaded();
  const clients = listClients();
  const params = await searchParams;
  const filterClient = params.client ?? "all";
  const filterStatus = params.status ?? "all";

  let runs: Awaited<ReturnType<typeof listRecentRuns>> = [];
  try {
    runs = await listRecentRuns(200);
  } catch {
    runs = [];
  }

  const filtered = runs.filter((r) => {
    if (filterClient !== "all" && r.clientId !== filterClient) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <>
      <AdminTopbar
        title="Logs & Conversations"
        description="Historique de toutes les actions de l'agent. Filtre par client, statut, etc."
      />
      <div className="flex flex-col gap-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="size-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap items-end gap-3" method="GET">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" htmlFor="client">
                  Client
                </label>
                <select
                  id="client"
                  name="client"
                  defaultValue={filterClient}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="all">Tous</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" htmlFor="status">
                  Statut
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={filterStatus}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="all">Tous</option>
                  <option value="success">Succès</option>
                  <option value="error">Erreur</option>
                </select>
              </div>
              <button
                type="submit"
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Filtrer
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="size-4" />
              {filtered.length} exécution{filtered.length > 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              Triées de la plus récente à la plus ancienne (200 max).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun log avec ces filtres.
              </p>
            ) : (
              <div className="flex flex-col">
                {filtered.map((r) => {
                  const mod = getModuleById(r.moduleId);
                  const client = clients.find((c) => c.id === r.clientId);
                  const ok = r.status === "success";
                  return (
                    <details
                      key={r.id}
                      className="group border-b border-border py-2.5 last:border-0"
                    >
                      <summary className="flex cursor-pointer items-start gap-3 list-none">
                        {ok ? (
                          <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="size-4 mt-0.5 shrink-0 text-destructive" />
                        )}
                        <div className="flex flex-1 min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {client ? (
                              <Link
                                href={`/clients/${client.id}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {client.name}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium">—</span>
                            )}
                            <span className="text-xs text-muted-foreground">·</span>
                            <Badge variant="outline">{mod?.name ?? r.moduleId}</Badge>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {new Date(r.startedAt).toLocaleString("fr-FR")}
                              {r.durationMs != null ? ` · ${r.durationMs} ms` : ""}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {r.summary ?? r.errorMessage ?? "—"}
                          </p>
                        </div>
                      </summary>
                      <div className="ml-7 mt-2 flex flex-col gap-2">
                        {r.errorMessage ? (
                          <pre className="rounded-md bg-destructive/10 p-3 text-xs text-destructive whitespace-pre-wrap">
                            {r.errorMessage}
                          </pre>
                        ) : null}
                        {r.logs.length > 0 ? (
                          <pre className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap max-h-60 overflow-auto">
                            {r.logs
                              .map((l) => `[${l.level}] ${l.message}`)
                              .join("\n")}
                          </pre>
                        ) : null}
                        {r.data ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Données de sortie
                            </summary>
                            <pre className="mt-1 rounded-md bg-muted p-3 text-xs max-h-60 overflow-auto">
                              {JSON.stringify(r.data, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
