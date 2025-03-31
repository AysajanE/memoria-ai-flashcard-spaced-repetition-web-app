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
              <div className="space-y-4 mt-4">
                {result?.cards ? (
                  result.cards.map((card: any, index: number) => (
                    <div key={index} className="bg-card p-5 rounded-lg border border-border shadow-sm hover:shadow-md transition-all">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">QUESTION</h4>
                        <p className="text-lg">{card.front}</p>
                      </div>
                      <div className="pt-4 border-t border-border/50">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">ANSWER</h4>
                        <p className="text-lg">{card.back}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No flashcards available</p>
                )}
              </div>
              <div className="flex gap-4 pt-6">
                <Button onClick={() => router.push("/decks")}>Save & View Decks</Button>
                <Button variant="outline" onClick={() => router.push("/create")}>Create New Cards</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                <div className="space-y-3">
                  <p className="font-medium text-lg">Error</p>
                  <p>{error || 'Unknown error'}</p>
                  
                  {/* If we have detailed error information */}
                  {result?.errorDetail && (
                    <div className="mt-4 pt-4 border-t border-destructive/20 space-y-2">
                      {result.errorDetail.category && (
                        <p className="text-sm">
                          <span className="font-semibold">Type:</span> {' '}
                          {result.errorDetail.category.replace(/_/g, ' ')}
                          {result.errorDetail.code && ` (${result.errorDetail.code})`}
                        </p>
                      )}
                      
                      {result.errorDetail.suggestedAction && (
                        <div className="bg-card p-3 rounded border border-muted text-sm">
                          <span className="font-semibold">Suggested action:</span>{' '}
                          {result.errorDetail.suggestedAction}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => router.push("/create")}>Try Again</Button>
                <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 