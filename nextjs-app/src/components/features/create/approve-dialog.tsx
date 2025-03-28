"use client";

import { useEffect, useState, useTransition } from "react";
import { Deck } from "@/types";
import { getDecksAction } from "@/actions/db/decks";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ApproveDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSubmit: (targetDeck: { id?: string; name?: string }) => void;
}

export function ApproveDialog({
  isOpen,
  setIsOpen,
  onSubmit,
}: ApproveDialogProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>();
  const [newDeckName, setNewDeckName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingDecks(true);
      setError(null);
      getDecksAction()
        .then((result) => {
          if (result.isSuccess && result.data) {
            setDecks(result.data);
          } else {
            setError(result.message || "Failed to fetch decks");
            toast.error(result.message || "Failed to fetch decks");
          }
        })
        .catch((err) => {
          setError("Failed to fetch decks");
          toast.error("Failed to fetch decks");
          console.error(err);
        })
        .finally(() => {
          setIsLoadingDecks(false);
        });
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedDeckId && !newDeckName) {
      setError("Please select an existing deck or create a new one");
      return;
    }

    if (newDeckName && newDeckName.length < 3) {
      setError("Deck name must be at least 3 characters long");
      return;
    }

    setError(null);
    startTransition(() => {
      onSubmit(selectedDeckId ? { id: selectedDeckId } : { name: newDeckName });
      setIsOpen(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 pb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Save to Deck
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Where would you like to save your flashcards?
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <Label htmlFor="deck-select" className="text-base font-medium">Existing Decks</Label>
            </div>
            
            <Select
              value={selectedDeckId}
              onValueChange={(value) => {
                setSelectedDeckId(value);
                setNewDeckName("");
                setError(null);
              }}
              disabled={isLoadingDecks || isPending}
            >
              <SelectTrigger 
                id="deck-select" 
                className="w-full border-gray-200 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              >
                <SelectValue
                  placeholder={
                    isLoadingDecks
                      ? "Loading your decks..."
                      : "Choose an existing deck..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <div className="p-1 max-h-[200px] overflow-y-auto">
                  {isLoadingDecks ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Loading your decks...</span>
                    </div>
                  ) : decks.length > 0 ? (
                    decks.map((deck) => (
                      <SelectItem 
                        key={deck.id} 
                        value={deck.id}
                        className="rounded-md focus:bg-indigo-50 dark:focus:bg-indigo-900/20"
                      >
                        <div className="flex items-center">
                          <div className="mr-2 w-2 h-2 rounded-full bg-indigo-500"></div>
                          {deck.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No decks found. Create a new one below.
                    </div>
                  )}
                </div>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <Label htmlFor="new-deck" className="text-base font-medium">Create New Deck</Label>
            </div>
            
            <div className="relative">
              <Input
                id="new-deck"
                placeholder="Enter a name for your new deck..."
                value={newDeckName}
                onChange={(e) => {
                  setNewDeckName(e.target.value);
                  setSelectedDeckId(undefined);
                  setError(null);
                }}
                className="pr-10 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                disabled={isPending}
              />
              {newDeckName && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            
            {newDeckName && (
              <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm text-purple-700 dark:text-purple-300 animate-fade-in">
                New deck "{newDeckName}" will be created
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
            className="mb-2 sm:mb-0 border-gray-200 dark:border-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (!selectedDeckId && !newDeckName)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all border-0"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving Cards...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Flashcards
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
