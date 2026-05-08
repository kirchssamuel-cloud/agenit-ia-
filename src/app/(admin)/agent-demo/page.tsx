import { ensureLoaded, listClients } from "@/lib/db/store";
import { AgentDemoUI } from "./agent-demo-ui";

export default async function AgentDemoPage() {
  await ensureLoaded();
  const clients = listClients().map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry ?? null,
  }));

  // En mode démo (pas de Supabase), il n'y a aucun client en base.
  // On en propose un fictif pour pouvoir démontrer le flux.
  const clientsWithFallback =
    clients.length > 0
      ? clients
      : [
          {
            id: "demo-client-id",
            name: "Solaris Énergie (démo)",
            industry: "Régie panneaux solaires",
          },
          {
            id: "demo-client-2",
            name: "Helios Habitat (démo)",
            industry: "Régie panneaux solaires",
          },
        ];

  return (
    <div className="p-6">
      <AgentDemoUI clients={clientsWithFallback} />
    </div>
  );
}
