/**
 * @file page.tsx
 * @description
 *  This page displays the status of a specific AI processing job and, once completed,
 *  shows the generated flashcards with an option to review and assign them to a deck.
 *
 * Key functionalities:
 *  - Poll the backend endpoint `/api/job-status/[jobId]` to get the latest job status
 *  - When job status = "completed", display the generated flashcards
 *  - When job status = "failed", display the error details
 *  - Provide a dialog for saving the cards to a user deck
 *
 * @dependencies
 *  - React/Next for UI rendering
 *  - `saveJobFlashcardsAction` and `getDecksAction` from `@/actions/db/decks` (for deck creation/selection)
 *  - `toast` for user notifications
 *  - Shadcn/ui components for styling (Dialog, Button, Input, etc.)
 *  - `useTransition` from React to handle server action transitions
 *  - React hooks for state management (`useEffect`, `useState`)
 *  - Clerk Auth is handled via route protection; user must be signed in to access
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveJobFlashcardsAction, getDecksAction } from "@/actions/db/decks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChangeEvent } from "react";

/**
 * Type definition for job data fetched from /api/job-status/[jobId].
 */
interface JobData {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  resultPayload?: {
    cards?: Array<{
      front: string;
      back: string;
      type?: "qa" | "cloze";
    }>;
  };
  errorMessage?: string;
}

/**
 * The main React component to display and handle AI job status + final results.
 */
export default function JobStatusPage({ params }: { params: { jobId: string } }) {
  /**
   * `status` tracks the overall job status. We'll store the entire job object in `jobState`.
   * `error` is for general errors fetching job status. `isDialogOpen` toggles the "Save Flashcards" dialog.
   */
  const router = useRouter();
  const { jobId } = params;

  const [jobState, setJobState] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // State for decks, user selection, and deck creation
  const [decks, setDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [deckName, setDeckName] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Tracks if we are currently saving flashcards to the deck
  const [isSaving, setIsSaving] = useState(false);

  // Let React manage server action transitions for us
  const [isPending, startTransition] = useTransition();

  /**
   * Poll the job status from the Next.js route /api/job-status/[jobId].
   * We'll poll every ~3 seconds as long as the job is not 'completed' or 'failed'.
   * If there's an error, we stop polling and set error state.
   */
  useEffect(() => {
    let intervalId: NodeJS.Timer | null = null;

    async function fetchJobStatus() {
      try {
        const res = await fetch(`/api/job-status/${jobId}`, {
          method: "GET",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch job status");
        }
        const data: JobData = await res.json();
        setJobState(data);

        if (data.status === "completed" || data.status === "failed") {
          // Once job is final, stop polling
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.error("Error fetching job status:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
        if (intervalId) clearInterval(intervalId);
      }
    }

    // Initial status check
    fetchJobStatus();

    // Poll every 3s until job is done or we hit an error
    intervalId = setInterval(() => {
      if (
        jobState?.status !== "completed" &&
        jobState?.status !== "failed" &&
        !error
      ) {
        fetchJobStatus();
      } else {
        if (intervalId) clearInterval(intervalId);
      }
    }, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, jobState?.status, error]);

  /**
   * Once the user wants to save the flashcards to a deck, we open a dialog.
   * We'll fetch the user's existing decks if not already loaded.
   */
  useEffect(() => {
    if (isDialogOpen) {
      setDialogError(null);
      setIsLoadingDecks(true);

      // Load user's decks
      getDecksAction()
        .then((result) => {
          if (result.isSuccess && result.data) {
            setDecks(result.data);
          } else {
            setDialogError(result.message || "Failed to fetch decks");
          }
        })
        .catch((err) => {
          console.error("Error fetching decks:", err);
          setDialogError("Failed to fetch decks");
        })
        .finally(() => {
          setIsLoadingDecks(false);
        });
    }
  }, [isDialogOpen]);

  // Tracks if we're in the middle of loading the deck list
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);

  /**
   * Handler to save the generated flashcards to a user-chosen or newly created deck.
   */
  async function handleSaveFlashcards() {
    if (!jobState?.resultPayload?.cards) {
      toast.error("No cards to approve or save");
      return;
    }
    if (!selectedDeckId && !deckName.trim()) {
      setDialogError("Please select an existing deck or create a new one");
      return;
    }
    if (deckName && deckName.length < 3) {
      setDialogError("Deck name must be at least 3 characters long");
      return;
    }

    setDialogError(null);
    setIsSaving(true);

    try {
      startTransition(async () => {
        const response = selectedDeckId
          ? await saveJobFlashcardsAction(jobId, selectedDeckId, true)
          : await saveJobFlashcardsAction(jobId, deckName);

        if (response.isSuccess) {
          toast.success("Flashcards saved successfully!");
          setIsDialogOpen(false);
          router.push(selectedDeckId ? `/study/${selectedDeckId}` : "/decks");
        } else {
          toast.error(response.message || "Failed to save flashcards");
          setDialogError(response.message || "Failed to save flashcards");
        }
        setIsSaving(false);
      });
    } catch (err) {
      console.error("Error saving flashcards:", err);
      toast.error("An unexpected error occurred");
      setIsSaving(false);
    }
  }

  /**
   * Render the main content depending on job status (pending, processing, completed, failed).
   */
  function renderContent() {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <p className="text-destructive text-center">{error}</p>
          <Button variant="outline" onClick={() => router.push("/create")}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!jobState) {
      // We haven't fetched the job yet or are still fetching
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading job status...</p>
        </div>
      );
    }

    if (jobState.status === "pending" || jobState.status === "processing") {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">
            {jobState.status === "pending"
              ? "Your job is queued and will start soon..."
              : "Generating cards, please wait..."}
          </p>
        </div>
      );
    }

    if (jobState.status === "failed") {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="rounded-full bg-red-100 p-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M6.938 4h13.124c1.54 0 2.502 1.667 1.732 3L13.732 20c-.77 1.333-2.694 1.333-3.464 0L3.34 7c-.77-1.333.192-3 1.732-3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-600">Generation Failed</h2>
          <p className="text-center text-muted-foreground">
            {jobState.errorMessage || "An error occurred while generating your flashcards."}
          </p>
          <Button onClick={() => router.push("/create")}>Try Again</Button>
        </div>
      );
    }

    // If status === 'completed' and we have resultPayload
    const cards = jobState.resultPayload?.cards || [];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Generation Complete!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {cards.length} flashcards have been generated successfully
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Generated Flashcards
            </h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Review these cards before approving
            </div>
          </div>

          <div className="grid gap-4">
            {cards.map((card, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-all">
                <div className="mb-2">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">QUESTION</h4>
                  <p className="text-lg">{card.front}</p>
                </div>
                <div className="pt-3 border-t border-border/50">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ANSWER</h4>
                  <p className="text-lg">{card.back}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setIsDialogOpen(true)}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve & Save to Deck
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Flashcard Generation"
        description="Your content is being processed into flashcards"
      />

      <div className="p-6 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-4">
          Job Status: {jobState?.status || "Loading..."}
        </h2>
        {renderContent()}
      </div>

      {/* Approve & Save to Deck Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              Save Flashcards
            </DialogTitle>
            <DialogDescription>
              Select an existing deck or create a new one to save your flashcards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Existing Decks Selection */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Choose Existing Deck</Label>
              <Select
                value={selectedDeckId}
                onValueChange={(value) => {
                  setSelectedDeckId(value);
                  setDeckName("");
                  setDialogError(null);
                }}
                disabled={isLoadingDecks || isSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingDecks
                        ? "Loading your decks..."
                        : "Select an existing deck..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingDecks ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Loading decks...</span>
                    </div>
                  ) : decks.length > 0 ? (
                    decks.map((deck) => (
                      <SelectItem key={deck.id} value={deck.id}>
                        {deck.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No decks found. Create a new one below.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Or divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">OR</span>
              </div>
            </div>

            {/* New Deck Creation */}
            <div className="space-y-2">
              <Label htmlFor="deckName" className="text-base font-medium">
                Create New Deck
              </Label>
              <Input
                id="deckName"
                value={deckName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setDeckName(e.target.value);
                  setSelectedDeckId("");
                  setDialogError(null);
                }}
                className="w-full"
                placeholder="Enter new deck name..."
                disabled={isSaving}
              />
              {deckName && (
                <p className="text-sm text-muted-foreground mt-1">
                  New deck &quot;{deckName}&quot; will be created
                </p>
              )}
            </div>

            {dialogError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                {dialogError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveFlashcards}
              disabled={isSaving || (!selectedDeckId && !deckName)}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Flashcards"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
