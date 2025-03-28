"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { JobStatus, FlashcardData } from "@/types";
import { cn } from "@/lib/utils";
import { ApproveDialog } from "@/components/features/create/approve-dialog";
import { reviewCardsAction } from "@/actions/ai";
import { toast } from "sonner";

export default function JobStatusPage() {
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<{
    status: JobStatus;
    resultPayload?: { cards: FlashcardData[] } | null;
    errorMessage?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`/api/job-status/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }
        const data = await response.json();
        setJob(data);

        // Stop polling if job is completed or failed
        if (data.status === "completed" || data.status === "failed") {
          setIsPolling(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setIsPolling(false);
      }
    };

    // Initial fetch
    fetchJobStatus();

    // Poll every 5 seconds if job is pending or processing
    const interval = setInterval(() => {
      if (isPolling) {
        fetchJobStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, isPolling]);

  const handleApproveSubmit = async (targetDeck: {
    id?: string;
    name?: string;
  }) => {
    if (!job?.resultPayload?.cards) {
      toast.error("No cards to approve");
      return;
    }

    startTransition(async () => {
      const result = await reviewCardsAction(
        jobId,
        job.resultPayload.cards,
        targetDeck
      );

      if (result.isSuccess) {
        toast.success(result.message);
        router.push(`/decks/${result.data.deckId}`);
      } else {
        toast.error(result.message || "Failed to approve cards");
      }
    });
  };

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <h1 className="text-destructive text-2xl font-bold">Error</h1>
            <p className="text-muted-foreground text-center">{error}</p>
            <Button onClick={() => router.push("/create")}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Loading job status...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card className="p-6">
        <div className="space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Job Status</h1>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  job.status === "completed" && "bg-green-500",
                  job.status === "failed" && "bg-red-500",
                  (job.status === "pending" || job.status === "processing") &&
                    "bg-yellow-500"
                )}
              />
              <span className="capitalize">{job.status}</span>
              {(job.status === "pending" || job.status === "processing") && (
                <Loader2 className="text-primary h-4 w-4 animate-spin" />
              )}
            </div>
          </div>

          {/* Loading State */}
          {(job.status === "pending" || job.status === "processing") && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground">
                {job.status === "pending"
                  ? "Your job is queued and will start soon..."
                  : "Generating cards, please wait..."}
              </p>
            </div>
          )}

          {/* Success State */}
          {job.status === "completed" && job.resultPayload?.cards && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Generated Cards</h2>
                <Button
                  onClick={() => setIsApproveDialogOpen(true)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    "Approve & Assign Cards"
                  )}
                </Button>
              </div>
              <div className="grid gap-4">
                {job.resultPayload.cards.map((card, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-2">
                      <div>
                        <h3 className="text-foreground font-medium">Front</h3>
                        <p className="text-muted-foreground">{card.front}</p>
                      </div>
                      <div>
                        <h3 className="text-foreground font-medium">Back</h3>
                        <p className="text-muted-foreground">{card.back}</p>
                      </div>
                      {card.type && (
                        <div className="text-muted-foreground text-sm">
                          Type: {card.type}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {job.status === "failed" && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <h2 className="text-destructive text-xl font-semibold">
                Job Failed
              </h2>
              <p className="text-muted-foreground text-center">
                {job.errorMessage}
              </p>
              <Button variant="outline" onClick={() => router.push("/create")}>
                Try Again
              </Button>
            </div>
          )}

          {/* Unexpected State */}
          {job.status === "completed" && !job.resultPayload?.cards && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <h2 className="text-xl font-semibold text-yellow-600">
                Unexpected State
              </h2>
              <p className="text-muted-foreground text-center">
                The job completed but no cards were generated. Please try again.
              </p>
              <Button variant="outline" onClick={() => router.push("/create")}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </Card>

      <ApproveDialog
        isOpen={isApproveDialogOpen}
        setIsOpen={setIsApproveDialogOpen}
        onSubmit={handleApproveSubmit}
      />
    </div>
  );
}
