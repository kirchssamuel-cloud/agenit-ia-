import { AdminTopbar } from "@/components/admin/sidebar";
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
        ];

  return (
    <>
      <AdminTopbar
        title="Démo Agent — Chat live"
        description="Discute avec l'agent IA pour démontrer la mémoire vectorielle (RAG) et l'agent superviseur. Affiche en temps réel les souvenirs retrouvés et les décisions de validation."
      />
      <div className="p-6">
        <AgentDemoUI clients={clientsWithFallback} />
      </div>
    </>
  );
}
