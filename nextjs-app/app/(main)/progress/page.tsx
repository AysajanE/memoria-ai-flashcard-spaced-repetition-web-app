import { getUserStatsAction } from "@/actions/tracking";
import { StatsDisplay } from "@/components/features/tracking/stats-display";
import { PageHeader } from "@/components/shared/page-header";

export default async function ProgressPage() {
  const statsResult = await getUserStatsAction();

  return (
    <div className="container space-y-6 py-6">
      <PageHeader
        heading="Your Progress"
        description="View detailed statistics about your learning journey."
      />

      <div className="space-y-6">
        <section>
          <h2 className="mb-4 text-lg font-semibold">Study Statistics</h2>
          <StatsDisplay
            stats={statsResult.isSuccess ? statsResult.data : null}
          />
        </section>

        {/* Placeholder for detailed progress charts - to be implemented */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Progress Over Time</h2>
          <div className="text-muted-foreground">
            Progress charts and detailed analytics will be displayed here.
          </div>
        </section>
      </div>
    </div>
  );
}
