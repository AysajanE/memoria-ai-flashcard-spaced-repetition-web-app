"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobData {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  resultPayload?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function JobStatusPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchJobStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/job-status/${jobId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch job status");
      }
      const data = await response.json();
      setJob(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching job status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchJobStatus();

    // Set up polling interval (5 seconds)
    intervalRef.current = setInterval(fetchJobStatus, 5000);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [jobId]);

  // Stop polling when job is completed or failed
  useEffect(() => {
    if (job?.status === "completed" || job?.status === "failed") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [job?.status]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="text-red-500 mb-4">Error: {error}</div>
        <button
          onClick={fetchJobStatus}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading && !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-gray-600">Loading job status...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <p className="text-gray-600">No job found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold mb-4">Job Status</h1>
        
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Job ID</h2>
            <p className="text-sm font-mono">{job.id}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-500">Status</h2>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  {
                    "bg-yellow-100 text-yellow-800": job.status === "pending",
                    "bg-blue-100 text-blue-800": job.status === "processing",
                    "bg-green-100 text-green-800": job.status === "completed",
                    "bg-red-100 text-red-800": job.status === "failed",
                  }
                )}
              >
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
              {job.status === "processing" && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
            </div>
          </div>

          {job.status === "pending" && (
            <p className="text-gray-600">Your job is queued and will start soon...</p>
          )}

          {job.status === "processing" && (
            <p className="text-gray-600">Generating flashcards, please wait...</p>
          )}

          {job.status === "completed" && job.resultPayload && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Results</h2>
              <div className="space-y-4">
                {job.resultPayload.cards?.map((card: any, index: number) => (
                  <div key={`${job.id}-card-${index}`} className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium mb-2">Card {index + 1}</div>
                    <div className="text-sm">
                      <div className="mb-1">
                        <span className="font-medium">Front:</span> {card.front}
                      </div>
                      <div>
                        <span className="font-medium">Back:</span> {card.back}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {job.status === "failed" && job.errorMessage && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Error</h2>
              <p className="text-red-600">{job.errorMessage}</p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Created: {new Date(job.createdAt).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            Last Updated: {new Date(job.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
} 