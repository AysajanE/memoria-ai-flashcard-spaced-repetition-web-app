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
              <div className="flex items-center justify-between bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Generation Complete!</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {job.resultPayload.cards.length} flashcards have been generated successfully
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsApproveDialogOpen(true)}
                  disabled={isPending}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all border-0"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve & Assign Cards
                    </>
                  )}
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Generated Flashcards
                  </h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Review these cards before approving
                  </div>
                </div>
                <div className="grid gap-4">
                  {job.resultPayload.cards.map((card, index) => (
                    <Card key={index} className="p-0 overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
                        <div className="p-5 bg-white dark:bg-gray-900 relative">
                          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center mr-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <h3 className="text-foreground font-medium">Front</h3>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{card.front}</p>
                        </div>
                        
                        <div className="p-5 bg-gray-50 dark:bg-gray-800 relative">
                          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mr-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <h3 className="text-foreground font-medium">Back</h3>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{card.back}</p>
                        </div>
                      </div>
                      {card.type && (
                        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${card.type === 'qa' ? 'bg-indigo-500' : 'bg-purple-500'}`}></div>
                          Type: {card.type === 'qa' ? 'Question & Answer' : 'Cloze Deletion'}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
                
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={() => setIsApproveDialogOpen(true)}
                    disabled={isPending}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all border-0 px-6 py-6 text-lg"
                    size="lg"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Approving Cards...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve & Save to Deck
                      </>
                    )}
                  </Button>
                </div>
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
