import { TEST_BANK, getTotalQuestionCount } from "@/data/test-bank";
import {
  listDomainMetrics,
  listOpenGaps,
  listRecentResults,
} from "@/lib/db/test-bank-store";
import { TestingDashboardUI } from "./testing-ui";

export default async function TestingPage() {
  const [metrics, gaps, recentResults] = await Promise.all([
    listDomainMetrics().catch(() => []),
    listOpenGaps().catch(() => []),
    listRecentResults(50).catch(() => []),
  ]);

  // Map domain → metrics (pour join avec TEST_BANK)
  const metricByDomain = new Map(metrics.map((m) => [m.domain, m]));

  const domains = TEST_BANK.map((suite) => {
    const m = metricByDomain.get(suite.domain);
    return {
      domain: suite.domain,
      name: suite.name,
      emoji: suite.emoji,
      questionCount: suite.questions.length,
      totalTests: m?.totalTests ?? 0,
      passedTests: m?.passedTests ?? 0,
      successRate: m?.successRate ?? null,
      avgScore: m?.avgScore ?? null,
      openGapsCount: m?.openGapsCount ?? 0,
      lastTested: m?.lastTested ?? null,
      trend: m?.trend ?? null,
    };
  });

  // Stats globales
  const totalQuestions = getTotalQuestionCount();
  const totalTested = metrics.reduce((s, m) => s + m.totalTests, 0);
  const totalPassed = metrics.reduce((s, m) => s + m.passedTests, 0);
  const globalSuccessRate =
    totalTested > 0 ? (totalPassed / totalTested) * 100 : null;
  const globalAvgScore =
    metrics.length > 0
      ? metrics.reduce((s, m) => s + m.avgScore, 0) / metrics.length
      : null;

  return (
    <div className="p-6">
      <TestingDashboardUI
        domains={domains}
        gaps={gaps}
        recentResults={recentResults.slice(0, 20)}
        globalStats={{
          totalDomains: TEST_BANK.length,
          totalQuestions,
          totalTested,
          totalPassed,
          globalSuccessRate,
          globalAvgScore,
          totalGapsOpen: gaps.length,
        }}
      />
    </div>
  );
}
