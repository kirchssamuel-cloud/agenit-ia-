import { AdminTopbar } from "@/components/admin/sidebar";
import { listClients, ensureLoaded } from "@/lib/db/store";
import { MODULE_REGISTRY } from "@/modules/registry";
import { PlaygroundForm } from "./playground-form";

export default async function PlaygroundPage() {
  await ensureLoaded();
  const clients = listClients().map((c) => ({ id: c.id, name: c.name }));
  const modules = MODULE_REGISTRY.filter((m) => Boolean(m.run)).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <>
      <AdminTopbar
        title="Playground"
        description="Tester un module pour un client avec un input réel. Utile pour valider le pipeline avant de mettre en prod."
      />
      <div className="p-8">
        <PlaygroundForm clients={clients} modules={modules} />
      </div>
    </>
  );
}
