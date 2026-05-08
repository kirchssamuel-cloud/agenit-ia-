import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** True si les clés Supabase sont des placeholders (mode démo). */
function isSupabasePlaceholder(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    process.env.DEMO_MODE === "true" ||
    url.includes("placeholder") ||
    key.includes("placeholder") ||
    url === "" ||
    key === ""
  );
}

export default async function Home() {
  // Mode démo : pas de Supabase, on envoie tout le monde sur la landing.
  if (isSupabasePlaceholder()) {
    redirect("/landing");
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  redirect("/landing");
}
