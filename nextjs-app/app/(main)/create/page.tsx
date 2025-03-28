"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { submitAiJobAction } from "@/actions/ai";

export default function CreatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputText, setInputText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await submitAiJobAction({
        jobType: "summarize",
        inputPayload: { text: inputText }
      });

      if (result.isSuccess && result.data?.jobId) {
        router.push(`/create/${result.data.jobId}`);
      } else {
        console.error("Failed to submit job:", result.message);
        // Handle error
      }
    } catch (error) {
      console.error("Error submitting job:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Create Flashcards"
        description="Enter text or upload documents to generate AI-powered flashcards."
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your text here..."
          className="min-h-[200px]"
        />
        <Button type="submit" disabled={isSubmitting || !inputText.trim()}>
          {isSubmitting ? "Processing..." : "Generate Flashcards"}
        </Button>
      </form>
    </div>
  );
} 