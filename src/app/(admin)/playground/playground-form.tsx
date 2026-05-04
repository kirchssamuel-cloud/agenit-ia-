"use client";

import { useState, useTransition } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { runPlaygroundAction, type PlaygroundResult } from "./actions";
import type { RunOutcome } from "@/agent/runner";

interface ClientOption {
  id: string;
  name: string;
}
interface ModuleOption {
  id: string;
  name: string;
}

const SAMPLE_CSV = `nom;prenom;telephone;email;ville
Dupont;Jean;06 12 34 56 78;jean.dupont@example.com;Paris
Martin;Sophie;0712345678;sophie.martin@example.com;Lyon
Dupont;Jean;06.12.34.56.78;jean.dupont@example.com;Paris
Bernard;Lucie;+33623456789;lucie.b@example.com;Marseille
Garcia;Pierre;033 6 11 22 33 44;p.garcia@example.com;Toulouse
`;

export function PlaygroundForm({
  clients,
  modules,
}: {
  clients: ClientOption[];
  modules: ModuleOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [fileContent, setFileContent] = useState(SAMPLE_CSV);

  const onSubmit = (formData: FormData) => {
    formData.set("fileContent", fileContent);
    startTransition(async () => {
      const r = await runPlaygroundAction(formData);
      setResult(r);
      if (!r.ok) toast.error(r.error);
      else toast.success(r.outcome.result.summary);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Lancer une exécution</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="clientId">Client</Label>
              <select
                id="clientId"
                name="clientId"
                required
                defaultValue={clients[0]?.id ?? ""}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="moduleId">Module</Label>
              <select
                id="moduleId"
                name="moduleId"
                required
                defaultValue={modules[0]?.id ?? ""}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fileContent">Contenu CSV (collez ou éditez le sample)</Label>
              <textarea
                id="fileContent"
                name="fileContent"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={10}
                className="rounded-md border border-input bg-transparent p-3 font-mono text-xs"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Exécution...
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" /> Lancer
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Résultat</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-sm text-muted-foreground">
              Lancez une exécution pour voir le résultat ici.
            </p>
          ) : !result.ok ? (
            <div className="text-sm text-destructive">{result.error}</div>
          ) : (
            <RunDetail outcome={result.outcome} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RunDetail({ outcome }: { outcome: RunOutcome }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant={outcome.result.ok ? "default" : "destructive"}>
          {outcome.result.ok ? "Succès" : "Erreur"}
        </Badge>
        <span className="text-muted-foreground">{outcome.durationMs} ms</span>
      </div>
      <p>{outcome.result.summary}</p>
      {outcome.result.error ? (
        <pre className="rounded-md bg-destructive/10 p-3 text-xs text-destructive whitespace-pre-wrap">
          {outcome.result.error}
        </pre>
      ) : null}
      {outcome.result.data ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Données ({Object.keys(outcome.result.data).length} clé(s))
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(outcome.result.data, null, 2)}
          </pre>
        </details>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Logs ({outcome.logs.length})
        </summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
          {outcome.logs.map((l, i) => (
            <div key={i} className="font-mono">
              <span className="text-muted-foreground">[{l.level}]</span> {l.message}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
