"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { submitAiJobAction } from "@/actions/ai";
import { Brain, AlertCircle, Loader2 } from "lucide-react";

export default function CreatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;

    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await submitAiJobAction({
        jobType: "summarize",
        inputPayload: { text: inputText }
      });

      if (result.isSuccess && result.data?.jobId) {
        // Store input text in session storage to maintain context across page navigation
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('lastInputText', inputText);
        }
        router.push(`/create/${result.data.jobId}`);
      } else {
        setError(result.message || "Failed to process your text. Please try again.");
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Error submitting job:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 space-y-8">
      <PageHeader
        heading="Create Flashcards"
        description="Transform your learning materials into effective flashcards"
      />

      <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-6 flex items-start">
        <Brain className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-foreground/90">
            Paste your text below to generate AI-powered flashcards. 
            The AI will analyze your content and create effective question-answer pairs.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-destructive mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground/90">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="inputText" className="text-sm font-medium">
            Your Learning Material
          </label>
          <Textarea
            id="inputText"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your notes, article, or any learning content here..."
            className="min-h-[240px] resize-y text-base p-4 focus:border-primary/50"
          />
        </div>
        
        <Button 
          type="submit" 
          disabled={isSubmitting || !inputText.trim()}
          className="w-full sm:w-auto px-8"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Generate Flashcards"
          )}
        </Button>
      </form>
    </div>
  );
} 