"use client";

import { useEffect, useState } from "react";
import { getDecksAction } from "@/actions/db/decks";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

// Define a type for deck with card count
interface DeckWithCount {
  id: string;
  name: string;
  cardCount: number;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDecks() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getDecksAction();

        if (!result.isSuccess) {
          setError(result.message ?? "Failed to load decks");
          toast.error(result.message || "Failed to load decks");
          return;
        }

        // Fetch card counts for each deck
        const decksWithCounts = await Promise.all(
          (result.data ?? []).map(async (deck) => {
            try {
              const response = await fetch(`/api/decks/${deck.id}`);
              if (response.ok) {
                const data = await response.json();
                return {
                  ...deck,
                  cardCount: data.cardCount || 0
                };
              }
              return { ...deck, cardCount: 0 };
            } catch (err) {
              console.error("Error fetching deck card count:", err);
              return { ...deck, cardCount: 0 };
            }
          })
        );

        setDecks(decksWithCounts);
      } catch (err) {
        setError("Failed to load decks");
        toast.error("Failed to load decks");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDecks();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-destructive">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>

      {decks.length === 0 ? (
        <div className="text-muted-foreground">
          You haven&apos;t created any decks yet. Create some flashcards first!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/study/${deck.id}`}>
              <Card className="hover:bg-accent/50 h-full transition-colors flex flex-col">
                <CardHeader>
                  <CardTitle>{deck.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex items-center text-muted-foreground mb-4">
                    <BookOpen className="h-4 w-4 mr-2" />
                    <span>{deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" className="w-full">
                    Study
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
