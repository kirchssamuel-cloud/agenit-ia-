import { AdminTopbar } from "@/components/admin/sidebar";
import { listModuleViews } from "@/lib/db/module-overrides";
import { countClientsForModule, ensureLoaded } from "@/lib/db/store";
import { ModulesEditor } from "./modules-editor";

export default async function ModulesPage() {
  await ensureLoaded();
  const views = await listModuleViews();
  const editorViews = views.map((v) => ({
    ...v,
    usedBy: countClientsForModule(v.id),
  }));

  return (
    <>
      <AdminTopbar
        title="Modules & prix"
        description="Fixe le prix mensuel facturé à tes clients pour chaque module. Active ou désactive la visibilité côté client."
      />
      <div className="flex flex-col gap-6 p-8">
        <ModulesEditor modules={editorViews} />
      </div>
    </>
  );
}
