"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { JobStatus, FlashcardData } from "@/types";
import { cn } from "@/lib/utils";

export default function JobStatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<{
    status: JobStatus;
    resultPayload?: { cards: FlashcardData[] } | null;
    errorMessage?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`/api/job-status/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }
        const data = await response.json();
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    };

    // Initial fetch
    fetchJobStatus();

    // Poll every 5 seconds if job is pending or processing
    const interval = setInterval(() => {
      if (job?.status === "pending" || job?.status === "processing") {
        fetchJobStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  if (error) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
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
            </div>
          </div>

          {/* Loading State */}
          {(job.status === "pending" || job.status === "processing") && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
              <p className="text-gray-600">Generating cards, please wait...</p>
            </div>
          )}

          {/* Success State */}
          {job.status === "completed" && job.resultPayload?.cards && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Generated Cards</h2>
              <div className="grid gap-4">
                {job.resultPayload.cards.map((card, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-medium text-gray-700">Front</h3>
                        <p className="text-gray-600">{card.front}</p>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-700">Back</h3>
                        <p className="text-gray-600">{card.back}</p>
                      </div>
                      {card.type && (
                        <div className="text-sm text-gray-500">
                          Type: {card.type}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              {/* TODO: Add Review Interface components here */}
            </div>
          )}

          {/* Error State */}
          {job.status === "failed" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-red-600">Job Failed</h2>
              <p className="text-gray-600">{job.errorMessage}</p>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/create"}
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Unexpected State */}
          {job.status === "completed" && !job.resultPayload?.cards && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-yellow-600">
                Unexpected State
              </h2>
              <p className="text-gray-600">
                The job completed but no cards were generated. Please try again.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/create"}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 