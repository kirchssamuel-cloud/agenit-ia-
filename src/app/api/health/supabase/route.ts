import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const checks: Record<string, unknown> = {};

    // Vérifie que les 3 tables existent
    for (const table of ["clients", "client_modules", "module_runs"] as const) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      checks[table] = error ? { error: error.message } : { count };
    }

    const allOk = Object.values(checks).every(
      (v) => typeof v === "object" && v !== null && !("error" in v),
    );

    return NextResponse.json({
      ok: allOk,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      checks,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
