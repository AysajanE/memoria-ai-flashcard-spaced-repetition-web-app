"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function StudyPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId as string;
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [completedCards, setCompletedCards] = useState<string[]>([]);
  const [deck, setDeck] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch deck and cards data
  useEffect(() => {
    const fetchDeckData = async () => {
      setIsLoading(true);
      try {
        // Fetch deck info
        const deckResponse = await fetch(`/api/decks/${deckId}`);
        if (!deckResponse.ok) {
          throw new Error("Failed to fetch deck information");
        }
        const deckData = await deckResponse.json();
        setDeck(deckData);
        
        // Fetch cards for deck
        const cardsResponse = await fetch(`/api/decks/${deckId}/cards`);
        if (!cardsResponse.ok) {
          throw new Error("Failed to fetch flashcards");
        }
        const cardsData = await cardsResponse.json();
        
        if (cardsData && Array.isArray(cardsData) && cardsData.length > 0) {
          setCards(cardsData);
        } else {
          setError("No flashcards found in this deck");
        }
      } catch (err) {
        console.error("Error fetching study data:", err);
        setError(err instanceof Error ? err.message : "Failed to load study materials");
        toast.error("Failed to load study materials");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDeckData();
  }, [deckId]);
  
  const handleShowAnswer = () => {
    setIsShowingAnswer(true);
  };
  
  const handleRating = (rating: "again" | "hard" | "good" | "easy") => {
    // In a real implementation, we would record the SRS rating
    // via a server action to update the card's SRS properties
    
    // For now, just mark as completed and move to next card
    if (cards[currentCardIndex]) {
      setCompletedCards(prev => [...prev, cards[currentCardIndex].id]);
    }
    
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsShowingAnswer(false);
    } else {
      // We've completed all cards
      toast.success("Study session completed!");
      setCompletedCards([]);
      router.push("/decks");
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading flashcards...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !deck || cards.length === 0) {
    return (
      <div className="container max-w-2xl py-8">
        <Link 
          href="/decks" 
          className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Decks
        </Link>
        
        <Card className="p-8 shadow-md border-transparent">
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">{error || "No flashcards available"}</h2>
            <p className="text-muted-foreground mb-4">
              {!error && "This deck doesn't have any flashcards to study."}
            </p>
            <Button onClick={() => router.push("/decks")}>
              Return to Decks
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  const currentCard = cards[currentCardIndex];
  
  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Link 
          href="/decks" 
          className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Decks
        </Link>
        <h1 className="text-2xl font-bold">{deck.name}</h1>
        <p className="text-muted-foreground">
          Card {currentCardIndex + 1} of {cards.length}
        </p>
      </div>
      
      <Card className="p-8 shadow-md border-transparent focus-within:ring-1 focus-within:ring-primary/30 transition-all mb-6">
        <div className="space-y-8">
          <div className="animate-fade-in">
            <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">Question</h3>
            <p className="text-xl leading-relaxed">{currentCard.front}</p>
          </div>

          {isShowingAnswer ? (
            <div className="animate-fade-in pt-6 border-t border-border/50">
              <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wide">Answer</h3>
              <p className="text-xl leading-relaxed">{currentCard.back}</p>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="space-y-4 mt-2">
        {!isShowingAnswer ? (
          <Button
            className="w-full font-medium shadow-sm hover:shadow-md transition-all"
            size="lg"
            onClick={handleShowAnswer}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Show Answer
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3 animate-fade-in">
            <Button
              variant="outline"
              className="w-full py-6 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/30"
              onClick={() => handleRating("again")}
            >
              <span className="font-medium">Again</span>
            </Button>
            <Button
              variant="outline"
              className="w-full py-6 border-orange-200 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-900/30"
              onClick={() => handleRating("hard")}
            >
              <span className="font-medium">Hard</span>
            </Button>
            <Button
              variant="outline"
              className="w-full py-6 border-green-200 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-900/30"
              onClick={() => handleRating("good")}
            >
              <span className="font-medium">Good</span>
            </Button>
            <Button
              variant="outline"
              className="w-full py-6 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/30"
              onClick={() => handleRating("easy")}
            >
              <span className="font-medium">Easy</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}