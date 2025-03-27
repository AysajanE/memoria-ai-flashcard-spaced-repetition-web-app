"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Flashcard } from "@/types";
import { getDeckStudySessionAction } from "@/actions/study";
import { Loader2 } from "lucide-react";

export default function StudyPage({ params }: { params: { deckId: string } }) {
  const [deckName, setDeckName] = useState<string>("");
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStudySession() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getDeckStudySessionAction(params.deckId);
        
        if (!result.isSuccess) {
          setError(result.message);
          return;
        }

        setDeckName(result.data.deckName);
        setStudyCards(result.data.cards);
        setCurrentCardIndex(0);
        setIsShowingAnswer(false);
      } catch (err) {
        setError("Failed to load study session");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStudySession();
  }, [params.deckId]);

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
      
      <Card className="p-6 min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-4">
            {isShowingAnswer ? currentCard.back : currentCard.front}
          </div>
          
          {/* TODO: Add answer reveal button and rating buttons */}
          <div className="text-sm text-muted-foreground">
            Card {currentCardIndex + 1} of {studyCards.length}
          </div>
        </div>
      </Card>
    </div>
  );
} 