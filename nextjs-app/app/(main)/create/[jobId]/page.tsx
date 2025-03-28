"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { getJobStatusAction } from "@/actions/ai";

export default function JobStatusPage({ params }: { params: { jobId: string } }) {
  const router = useRouter();
  const { jobId } = params;
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await getJobStatusAction(jobId);
        
        if (response.isSuccess && response.data) {
          setStatus(response.data.status);
          
          if (response.data.status === 'completed') {
            setResult(response.data.result);
          } else if (response.data.status === 'failed') {
            setError(response.data.error || 'An error occurred during processing');
          }
        } else {
          setError('Failed to fetch job status');
        }
      } catch (err) {
        console.error('Error checking job status:', err);
        setError('Failed to fetch job status');
      }
    };

    // Initial check
    checkStatus();

    // Set up polling if job is not completed
    const interval = setInterval(() => {
      if (status !== 'completed' && status !== 'failed') {
        checkStatus();
      } else {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, status]);

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Flashcard Generation"
        description="Your content is being processed into flashcards"
      />

      <div className="space-y-6">
        {/* Status display */}
        <div className="p-6 bg-muted rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Job Status: {status}</h2>
          
          {status === 'pending' || status === 'processing' ? (
            <div className="flex flex-col items-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Processing your content, please wait...</p>
            </div>
          ) : status === 'completed' ? (
            <div className="space-y-4">
              <h3 className="font-medium">Generated Flashcards:</h3>
              <div className="bg-card p-4 rounded-md">
                {result ? (
                  <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                ) : (
                  <p>No results available</p>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <Button onClick={() => router.push("/dashboard")}>Save & Return to Dashboard</Button>
                <Button variant="outline" onClick={() => router.push("/create")}>Create New Cards</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                <p className="font-medium">Error: {error || 'Unknown error'}</p>
              </div>
              <Button onClick={() => router.push("/create")}>Try Again</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 