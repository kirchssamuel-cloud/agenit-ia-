import { redirect } from "next/navigation";
import { ChooseModulesForm } from "./choose-modules-form";
import { listModuleViews } from "@/lib/db/module-overrides";

export default async function ChooseModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;
  if (!params.clientId) {
    redirect("/signup");
  }

  // Seuls les modules activés par l'admin sont visibles côté client.
  const visibleModules = await listModuleViews({ onlyEnabled: true });
  const modules = visibleModules.map((m) => ({
    id: m.id,
    name: m.name,
    shortDescription: m.shortDescription,
    longDescription: m.longDescription,
    monthlyEUR: m.monthlyEUR,
    category: m.category,
    status: m.status,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Choisis tes modules</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Active uniquement ce dont tu as besoin. Tu peux ajouter ou retirer à tout
          moment depuis ton dashboard.
        </p>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun module disponible pour le moment. L&apos;administrateur n&apos;a
          activé aucun module.
        </div>
      ) : (
        <ChooseModulesForm modules={modules} clientId={params.clientId} />
      )}
    </div>
  );
}
