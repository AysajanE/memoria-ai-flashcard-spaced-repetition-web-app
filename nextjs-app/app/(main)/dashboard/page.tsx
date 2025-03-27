import { getUserStatsAction } from "@/actions/tracking";
import { StatsDisplay } from "@/components/features/tracking/stats-display";
import { PageHeader } from "@/components/shared/page-header";

export default async function DashboardPage() {
  const statsResult = await getUserStatsAction();

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Dashboard"
        description="Track your learning progress and recent activity."
      />

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-4">Your Progress</h2>
          <StatsDisplay stats={statsResult.isSuccess ? statsResult.data : null} />
        </section>

        {/* Placeholder for recent activity - to be implemented */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="text-muted-foreground">
            Recent activity will be displayed here.
          </div>
        </section>
      </div>
    </div>
  );
} 