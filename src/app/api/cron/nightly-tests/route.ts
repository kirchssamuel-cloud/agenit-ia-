import { NextResponse, type NextRequest } from "next/server";
import { runAllDomains } from "@/lib/testing/test-runner";

/**
 * Cron Vercel — exécute la suite complète de tests chaque nuit à 3h.
 *
 * Configuration : voir vercel.json
 *   { "crons": [{ "path": "/api/cron/nightly-tests", "schedule": "0 3 * * *" }] }
 *
 * Sécurité : Vercel envoie un header Authorization=Bearer $CRON_SECRET.
 * On vérifie ce secret pour empêcher les exécutions non autorisées.
 *
 * Doc : https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max (Vercel Pro requis pour > 60s)

export async function GET(request: NextRequest) {
  // Vérification du secret cron Vercel
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  const t0 = Date.now();
  console.log("[cron/nightly-tests] start");

  try {
    const results = await runAllDomains();
    const totalTests = results.reduce((s, r) => s + r.totalTests, 0);
    const totalPassed = results.reduce((s, r) => s + r.passedTests, 0);
    const globalSuccessRate =
      totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
    const totalCostCents = results.reduce(
      (s, r) => s + r.totalCostCents,
      0,
    );
    const durationMs = Date.now() - t0;

    console.log(
      `[cron/nightly-tests] done ${totalPassed}/${totalTests} (${globalSuccessRate.toFixed(0)}%) en ${durationMs}ms · ${totalCostCents}¢`,
    );

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      durationMs,
      totalTests,
      totalPassed,
      globalSuccessRate,
      totalCostCents,
      perDomain: results.map((r) => ({
        domain: r.domain,
        passed: r.passedTests,
        total: r.totalTests,
        avgScore: r.avgScore,
      })),
    });
  } catch (err) {
    console.error(`[cron/nightly-tests] échec : ${(err as Error).message}`);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
