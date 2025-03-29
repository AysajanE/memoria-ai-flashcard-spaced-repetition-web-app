"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

// Mock flashcards data
const MOCK_FLASHCARDS = [
  {
    id: "card_1",
    front: "What is the capital of France?",
    back: "Paris",
  },
  {
    id: "card_2",
    front: "What are the three states of matter?",
    back: "Solid, liquid, and gas",
  },
  {
    id: "card_3",
    front: "Who wrote 'Romeo and Juliet'?",
    back: "William Shakespeare",
  }
];

export default function StudyPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.deckId as string;
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [completedCards, setCompletedCards] = useState<string[]>([]);
  
  // Mock deck information
  const deckInfo = {
    name: deckId === "deck_1" ? "Introduction to Biology" : 
          deckId === "deck_2" ? "World History" : 
          deckId === "deck_3" ? "Spanish Vocabulary" : "Study Deck"
  };
  
  const handleShowAnswer = () => {
    setIsShowingAnswer(true);
  };
  
  const handleRating = (rating: "again" | "hard" | "good" | "easy") => {
    // In a real app, we would record the rating
    // For this demo, just mark the card as completed and move to the next one
    setCompletedCards(prev => [...prev, MOCK_FLASHCARDS[currentCardIndex].id]);
    
    if (currentCardIndex < MOCK_FLASHCARDS.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsShowingAnswer(false);
    } else {
      // We've completed all cards
      setCompletedCards([]);
      router.push("/decks");
    }
  };
  
  const currentCard = MOCK_FLASHCARDS[currentCardIndex];
  
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
        <h1 className="text-2xl font-bold">{deckInfo.name}</h1>
        <p className="text-muted-foreground">
          Card {currentCardIndex + 1} of {MOCK_FLASHCARDS.length}
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