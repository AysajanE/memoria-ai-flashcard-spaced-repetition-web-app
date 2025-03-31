"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { getJobStatusAction } from "@/actions/ai";
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
import { toast } from "sonner";
import { saveJobFlashcardsAction, getDecksAction } from "@/actions/db/decks";
import { ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function JobStatusPage({ params }: { params: { jobId: string } }) {
  const router = useRouter();
  const { jobId } = params;
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [decks, setDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await getJobStatusAction(jobId);
        
        if (response.isSuccess && response.data) {
          // Convert the string status to our enum type
          const jobStatus = response.data.status as 'pending' | 'processing' | 'completed' | 'failed';
          setStatus(jobStatus);
          
          if (jobStatus === 'completed') {
            setResult(response.data.result);
          } else if (jobStatus === 'failed') {
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

  useEffect(() => {
    if (isDialogOpen) {
      setIsLoadingDecks(true);
      setDialogError(null);
      
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

  const handleSaveFlashcards = async () => {
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
          // Navigate to the appropriate page
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
  };

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
                <Button onClick={() => setIsDialogOpen(true)}>Save & View Decks</Button>
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

      {/* Enhanced Deck Creation/Selection Dialog */}
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
                  <SelectValue placeholder={
                    isLoadingDecks
                      ? "Loading your decks..."
                      : "Select an existing deck..."
                  } />
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
                  New deck "{deckName}" will be created
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