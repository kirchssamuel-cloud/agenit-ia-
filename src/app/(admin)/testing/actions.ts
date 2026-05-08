"use server";

import { revalidatePath } from "next/cache";
import { runDomainSuite, runAllDomains } from "@/lib/testing/test-runner";
import { setGapStatus, type GapStatus } from "@/lib/db/test-bank-store";

export async function runDomainAction(domain: string): Promise<{
  ok: boolean;
  error?: string;
  successRate?: number;
  avgScore?: number;
  totalTests?: number;
}> {
  if (!domain) return { ok: false, error: "domaine manquant" };
  try {
    const r = await runDomainSuite(domain);
    revalidatePath("/testing");
    return {
      ok: true,
      successRate: r.successRate,
      avgScore: r.avgScore,
      totalTests: r.totalTests,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function runAllDomainsAction(): Promise<{
  ok: boolean;
  error?: string;
  totalDomains?: number;
  totalTests?: number;
}> {
  try {
    const results = await runAllDomains();
    revalidatePath("/testing");
    const totalTests = results.reduce((s, r) => s + r.totalTests, 0);
    return {
      ok: true,
      totalDomains: results.length,
      totalTests,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateGapStatusAction(
  gapId: string,
  status: GapStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await setGapStatus(gapId, status);
    revalidatePath("/testing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
