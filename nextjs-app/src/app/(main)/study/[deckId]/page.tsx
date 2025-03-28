"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Flashcard } from "@/types";
import {
  getDeckStudySessionAction,
  recordStudyRatingAction,
} from "@/actions/study";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function StudyPage({ params }: { params: { deckId: string } }) {
  const [deckName, setDeckName] = useState<string>("");
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRating, setIsRating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionComplete, setIsSessionComplete] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    async function loadStudySession() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getDeckStudySessionAction(params.deckId);

        if (!result.isSuccess) {
          setError(result.message);
          toast.error(result.message || "Failed to load study session");
          return;
        }

        setDeckName(result.data.deckName);
        setStudyCards(result.data.cards);
        setCurrentCardIndex(0);
        setIsShowingAnswer(false);
      } catch (err) {
        setError("Failed to load study session");
        toast.error("Failed to load study session");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStudySession();
  }, [params.deckId]);

  const handleRating = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!studyCards[currentCardIndex]) return;

    setIsRating(true);
    try {
      const result = await recordStudyRatingAction(
        studyCards[currentCardIndex].id,
        rating
      );

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
        setTimeout(() => {
          router.push("/decks");
        }, 2000);
      }
    } catch (err) {
      toast.error("Failed to record rating");
      console.error(err);
    } finally {
      setIsRating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Loading study session...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <p className="text-destructive text-center">{error}</p>
            <Button onClick={() => router.push("/decks")}>
              Return to Decks
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (studyCards.length === 0) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <h2 className="text-xl font-semibold">No Cards Due</h2>
            <p className="text-muted-foreground text-center">
              There are no cards due for review in this deck.
            </p>
            <Button onClick={() => router.push("/decks")}>
              Return to Decks
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isSessionComplete) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <h2 className="text-2xl font-bold">Session Complete!</h2>
            <p className="text-muted-foreground text-center">
              Great job! You&apos;ve completed all cards in this session.
            </p>
            <Button onClick={() => router.push("/decks")}>
              Return to Decks
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentCard = studyCards[currentCardIndex];
  if (!currentCard) {
    return (
      <div className="container max-w-2xl py-8">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <p className="text-muted-foreground">No cards to study.</p>
            <Button onClick={() => router.push("/decks")}>
              Return to Decks
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{deckName}</h1>
            <div className="text-muted-foreground text-sm">
              Card {currentCardIndex + 1} of {studyCards.length}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border p-4">
              <p className="text-lg">{currentCard.front}</p>
            </div>

            {isShowingAnswer && (
              <div className="bg-muted/50 flex min-h-[200px] items-center justify-center rounded-lg border p-4">
                <p className="text-lg">{currentCard.back}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {!isShowingAnswer ? (
              <Button
                className="w-full"
                size="lg"
                onClick={() => setIsShowingAnswer(true)}
                disabled={isRating}
              >
                Show Answer
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleRating("again")}
                  disabled={isRating}
                >
                  {isRating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Again
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleRating("hard")}
                  disabled={isRating}
                >
                  {isRating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Hard
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleRating("good")}
                  disabled={isRating}
                >
                  {isRating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Good
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleRating("easy")}
                  disabled={isRating}
                >
                  {isRating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Easy
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
