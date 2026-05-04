import { ChooseModulesForm } from "./choose-modules-form";
import { MODULE_REGISTRY } from "@/modules/registry";

export default function ChooseModulesPage() {
  const modules = MODULE_REGISTRY.map((m) => ({
    id: m.id,
    name: m.name,
    shortDescription: m.shortDescription,
    longDescription: m.longDescription ?? "",
    monthlyEUR: m.pricing?.monthlyEUR ?? 0,
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

      <ChooseModulesForm modules={modules} />
    </div>
  );
}
