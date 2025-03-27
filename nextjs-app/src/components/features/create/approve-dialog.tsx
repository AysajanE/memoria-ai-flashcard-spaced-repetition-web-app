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

interface ApproveDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSubmit: (targetDeck: { id?: string; name?: string }) => void;
}

export function ApproveDialog({ isOpen, setIsOpen, onSubmit }: ApproveDialogProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>();
  const [newDeckName, setNewDeckName] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      getDecksAction().then((result) => {
        if (result.isSuccess && result.data) {
          setDecks(result.data);
        } else {
          toast.error("Failed to fetch decks");
        }
      });
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedDeckId && !newDeckName) {
      toast.error("Please select a deck or create a new one");
      return;
    }

    startTransition(() => {
      onSubmit(selectedDeckId ? { id: selectedDeckId } : { name: newDeckName });
      setIsOpen(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve & Assign Cards</DialogTitle>
          <DialogDescription>
            Select an existing deck or create a new one to store your flashcards.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="deck-select">Select Existing Deck</Label>
            <Select
              value={selectedDeckId}
              onValueChange={(value) => {
                setSelectedDeckId(value);
                setNewDeckName("");
              }}
            >
              <SelectTrigger id="deck-select">
                <SelectValue placeholder="Select existing deck..." />
              </SelectTrigger>
              <SelectContent>
                {decks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>
                    {deck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-deck">Or Create New Deck</Label>
            <Input
              id="new-deck"
              placeholder="Enter new deck name..."
              value={newDeckName}
              onChange={(e) => {
                setNewDeckName(e.target.value);
                setSelectedDeckId(undefined);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Processing..." : "Approve & Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 