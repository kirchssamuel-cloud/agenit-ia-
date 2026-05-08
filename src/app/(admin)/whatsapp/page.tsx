import { ensureLoaded, listClients } from "@/lib/db/store";
import { listAllNumbers } from "@/lib/db/whatsapp";
import { checkAllConnections } from "@/lib/whatsapp/connection-check";
import { WhatsAppPoolUI } from "./pool-ui";

export const dynamic = "force-dynamic";

export default async function WhatsAppAdminPage() {
  await ensureLoaded();
  const [numbers, clients, connections] = await Promise.all([
    listAllNumbers(),
    Promise.resolve(listClients()),
    checkAllConnections(),
  ]);

  // Map clientId → name pour affichage
  const clientNameById = new Map<string, string>();
  for (const c of clients) clientNameById.set(c.id, c.name);

  const numbersWithClient = numbers.map((n) => ({
    ...n,
    clientName: n.clientId ? clientNameById.get(n.clientId) ?? null : null,
  }));

  const stats = {
    total: numbers.length,
    available: numbers.filter((n) => n.status === "available").length,
    assigned: numbers.filter((n) => n.status === "assigned").length,
    suspended: numbers.filter((n) => n.status === "suspended").length,
  };

  return (
    <div className="p-6">
      <WhatsAppPoolUI
        numbers={numbersWithClient}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        stats={stats}
        connections={connections}
      />
    </div>
  );
}
