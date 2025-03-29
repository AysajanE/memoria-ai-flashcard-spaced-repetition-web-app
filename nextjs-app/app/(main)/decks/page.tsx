"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Mock data for demonstration
const MOCK_DECKS = [
  {
    id: "deck_1",
    name: "Introduction to Biology",
    description: "Basic concepts of biology",
    cardCount: 24,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "deck_2",
    name: "World History",
    description: "Key events in world history",
    cardCount: 32,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "deck_3",
    name: "Spanish Vocabulary",
    description: "Common Spanish words and phrases",
    cardCount: 50,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  }
];

export default function DecksPage() {
  const [decks, setDecks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading decks
    const loadDecks = async () => {
      setIsLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setDecks(MOCK_DECKS);
      } catch (err) {
        setError("Failed to load decks");
        toast.error("Failed to load decks");
      } finally {
        setIsLoading(false);
      }
    };

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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Decks</h1>
        <Link href="/create">
          <Button>Create New Deck</Button>
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="text-muted-foreground text-center py-12">
          <p className="mb-4">You haven&apos;t created any decks yet.</p>
          <Link href="/create">
            <Button>Create Your First Deck</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/study/${deck.id}`}>
              <Card className="hover:bg-accent/50 h-full transition-colors">
                <CardHeader>
                  <CardTitle>{deck.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{deck.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-muted-foreground">{deck.cardCount} cards</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(deck.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Button variant="secondary" className="w-full">
                    Study
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}