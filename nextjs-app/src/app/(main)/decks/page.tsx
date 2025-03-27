"use client";

import { useEffect, useState } from "react";
import { getDecksAction } from "@/actions/db/decks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DecksPage() {
  const [decks, setDecks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDecks() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getDecksAction();
        
        if (!result.isSuccess) {
          setError(result.message);
          toast.error(result.message || "Failed to load decks");
          return;
        }

        setDecks(result.data);
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
        <h1 className="text-3xl font-bold mb-8">Your Decks</h1>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Your Decks</h1>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-destructive">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Your Decks</h1>
      
      {decks.length === 0 ? (
        <div className="text-muted-foreground">
          You haven't created any decks yet. Create some flashcards first!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <Link key={deck.id} href={`/study/${deck.id}`}>
              <Card className="h-full hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <CardTitle>{deck.name}</CardTitle>
                </CardHeader>
                <CardContent>
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