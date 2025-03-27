"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewCard } from "@/components/features/create/review-card";
import { FlashcardData } from "@/types";
import { JobStatus } from "@/types";
import { getJobStatus } from "@/lib/api/jobs";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorDisplay } from "@/components/shared/error-display";

export default function JobStatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [reviewCards, setReviewCards] = useState<FlashcardData[]>([]);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJobStatus(jobId),
    refetchInterval: (data) => {
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      return 2000;
    },
  });

  useEffect(() => {
    if (job?.status === "completed" && job.resultPayload?.cards) {
      setReviewCards(job.resultPayload.cards.map((card, index) => ({ ...card, tempId: index })));
    }
  }, [job]);

  const handleDeleteCard = (index: number) => {
    setReviewCards((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCard = (index: number, updatedCard: FlashcardData) => {
    console.log("Updating card:", { index, updatedCard });
    // Placeholder for update logic
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!job) {
    return <ErrorDisplay error={new Error("Job not found")} />;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Job Status</h1>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Status</h2>
              <p className="text-muted-foreground">{job.status}</p>
            </div>
            {job.status === JobStatus.COMPLETED && job.resultPayload && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4">Generated Cards</h2>
                  <div className="space-y-4">
                    {reviewCards.map((card, index) => (
                      <ReviewCard
                        key={card.tempId}
                        cardData={card}
                        index={index}
                        onDelete={handleDeleteCard}
                        onUpdate={handleUpdateCard}
                      />
                    ))}
                  </div>
                </div>
                {/* Placeholder for Add Manual Card button */}
                {/* Placeholder for Approve & Assign button */}
              </div>
            )}
            {job.status === JobStatus.FAILED && job.error && (
              <div>
                <h2 className="text-lg font-semibold text-destructive">Error</h2>
                <p className="text-muted-foreground">{job.error}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 