"use client";

import { useState, useTransition, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { recordStudyRatingAction, getStudyCardsAction } from "@/actions/study";
import { Loader2 } from "lucide-react";

interface StudyCard {
  id: string;
  front: string;
  back: string;
}

export default function StudyPage() {
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [studyCards, setStudyCards] = useState<StudyCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const result = await getStudyCardsAction(params.deckId as string);
        if (!result.isSuccess) {
          throw new Error(result.message || "Failed to fetch cards");
        }
        setStudyCards(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        toast.error(err instanceof Error ? err.message : "Failed to load study cards");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCards();
  }, [params.deckId]);

  const handleShowAnswer = () => {
    setIsShowingAnswer(true);
  };

  const handleRating = async (rating: "Again" | "Hard" | "Good" | "Easy") => {
    const currentCard = studyCards[currentCardIndex];
    if (!currentCard) return;

    startTransition(async () => {
      const result = await recordStudyRatingAction(currentCard.id, rating);

      if (!result.isSuccess) {
        toast.error(result.message || "Failed to record rating");
        return;
      }

      // Move to next card or end session
      if (currentCardIndex + 1 < studyCards.length) {
        setCurrentCardIndex((prev) => prev + 1);
        setIsShowingAnswer(false);
      } else {
        setIsSessionComplete(true);
        // Optional: Redirect after a delay
        setTimeout(() => {
          router.push("/decks");
        }, 2000);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => router.push("/decks")}>Return to Decks</Button>
        </Card>
      </div>
    );
  }

  if (studyCards.length === 0) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">No Cards Due</h2>
          <p className="text-muted-foreground mb-6">
            There are no cards due for review in this deck.
          </p>
          <Button onClick={() => router.push("/decks")}>Return to Decks</Button>
        </Card>
      </div>
    );
  }

  if (isSessionComplete) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Session Complete!</h2>
          <p className="text-muted-foreground mb-6">
            Great job! You've completed all cards in this session.
          </p>
          <Button onClick={() => router.push("/decks")}>Return to Decks</Button>
        </Card>
      </div>
    );
  }

  const currentCard = studyCards[currentCardIndex];
  if (!currentCard) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No cards to study.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <div className="space-y-6">
        {/* Progress indicator */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            Card {currentCardIndex + 1} of {studyCards.length}
          </span>
        </div>

        {/* Card display */}
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-2">Question</h3>
              <p className="text-lg">{currentCard.front}</p>
            </div>

            {isShowingAnswer ? (
              <div>
                <h3 className="font-medium text-sm text-muted-foreground mb-2">Answer</h3>
                <p className="text-lg">{currentCard.back}</p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Action buttons */}
        <div className="space-y-4">
          {!isShowingAnswer ? (
            <Button
              className="w-full"
              size="lg"
              onClick={handleShowAnswer}
            >
              Show Answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleRating("Again")}
                disabled={isPending}
              >
                Again
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleRating("Hard")}
                disabled={isPending}
              >
                Hard
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleRating("Good")}
                disabled={isPending}
              >
                Good
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleRating("Easy")}
                disabled={isPending}
              >
                Easy
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 