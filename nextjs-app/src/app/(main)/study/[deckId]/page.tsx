"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Flashcard } from "@/types";
import { getDeckStudySessionAction, recordStudyRatingAction } from "@/actions/study";
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
      const result = await recordStudyRatingAction(studyCards[currentCardIndex].id, rating);
      
      if (!result.isSuccess) {
        toast.error(result.message || "Failed to record rating");
        return;
      }

      // Move to next card or end session
      if (currentCardIndex < studyCards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setIsShowingAnswer(false);
      } else {
        toast.success("Study session completed!");
        router.push("/decks");
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  if (studyCards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">No cards due for this deck today.</div>
      </div>
    );
  }

  const currentCard = studyCards[currentCardIndex];

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">{deckName}</h1>
      
      <Card className="p-6 min-h-[200px] flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-4">
            {currentCard.front}
          </div>
          
          {!isShowingAnswer ? (
            <Button 
              onClick={() => setIsShowingAnswer(true)}
              className="mb-4"
              disabled={isRating}
            >
              Show Answer
            </Button>
          ) : (
            <>
              <div className="text-lg mb-6 text-muted-foreground">
                {currentCard.back}
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="destructive"
                  onClick={() => handleRating("again")}
                  disabled={isRating}
                >
                  Again
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => handleRating("hard")}
                  disabled={isRating}
                >
                  Hard
                </Button>
                <Button 
                  onClick={() => handleRating("good")}
                  disabled={isRating}
                >
                  Good
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => handleRating("easy")}
                  disabled={isRating}
                >
                  Easy
                </Button>
              </div>
            </>
          )}
          
          <div className="text-sm text-muted-foreground mt-4">
            Card {currentCardIndex + 1} of {studyCards.length}
          </div>
        </div>
      </Card>
    </div>
  );
} 