"use client";

import { useEffect, useState, useCallback } from "react";
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
          setError(result.message ?? "Failed to load study session");
          toast.error(result.message || "Failed to load study session");
          return;
        }

        setDeckName(result.data?.deckName ?? "");
        setStudyCards(result.data?.cards ?? []);
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

  const handleRating = useCallback(async (rating: "again" | "hard" | "good" | "easy") => {
    if (!studyCards[currentCardIndex]) return;

    setIsRating(true);
    try {
      const result = await recordStudyRatingAction(
        studyCards[currentCardIndex].id,
        rating as "Again" | "Hard" | "Good" | "Easy"
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
  }, [studyCards, currentCardIndex, router]);

  // Keyboard shortcuts handler
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Prevent shortcuts during loading states
      if (isLoading || isRating || isSessionComplete) {
        return;
      }

      // Only process if we have a current card
      if (!studyCards[currentCardIndex]) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ': // Space key
          event.preventDefault();
          if (!isShowingAnswer) {
            setIsShowingAnswer(true);
            // Announce to screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = 'Answer revealed. Use keys 1-4 to rate your performance.';
            document.body.appendChild(announcement);
            setTimeout(() => document.body.removeChild(announcement), 1000);
          }
          break;
        case '1':
          event.preventDefault();
          if (isShowingAnswer) {
            handleRating("again");
            // Announce to screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            announcement.textContent = 'Rated as Again';
            document.body.appendChild(announcement);
            setTimeout(() => document.body.removeChild(announcement), 1000);
          }
          break;
        case '2':
          event.preventDefault();
          if (isShowingAnswer) {
            handleRating("hard");
            // Announce to screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            announcement.textContent = 'Rated as Hard';
            document.body.appendChild(announcement);
            setTimeout(() => document.body.removeChild(announcement), 1000);
          }
          break;
        case '3':
          event.preventDefault();
          if (isShowingAnswer) {
            handleRating("good");
            // Announce to screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            announcement.textContent = 'Rated as Good';
            document.body.appendChild(announcement);
            setTimeout(() => document.body.removeChild(announcement), 1000);
          }
          break;
        case '4':
          event.preventDefault();
          if (isShowingAnswer) {
            handleRating("easy");
            // Announce to screen readers
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            announcement.textContent = 'Rated as Easy';
            document.body.appendChild(announcement);
            setTimeout(() => document.body.removeChild(announcement), 1000);
          }
          break;
      }
    },
    [studyCards, currentCardIndex, isShowingAnswer, isLoading, isRating, isSessionComplete, handleRating]
  );

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

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
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            {deckName}
          </h1>
          <p className="text-muted-foreground">
            Study session in progress
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm font-medium">
            Card <span className="text-indigo-600 dark:text-indigo-400">{currentCardIndex + 1}</span> of <span className="text-indigo-600 dark:text-indigo-400">{studyCards.length}</span>
          </div>
        </div>
      </div>

      <Card className="p-8 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
        <div className="space-y-8">
          <div className="space-y-6 relative">
            <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-300 ${isShowingAnswer ? 'opacity-80 scale-95' : 'transform-gpu'}`}>
              <div className="p-6 min-h-[200px] flex flex-col justify-center">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg mb-4 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xl font-medium">{currentCard.front}</p>
              </div>
            </div>

            {isShowingAnswer && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm animate-fade-in mt-4">
                <div className="p-6 min-h-[200px] flex flex-col justify-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg mb-4 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-xl">{currentCard.back}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4">
            {!isShowingAnswer ? (
              <div className="space-y-3">
                <Button
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all border-0"
                  size="lg"
                  onClick={() => setIsShowingAnswer(true)}
                  disabled={isRating}
                >
                  Show Answer
                </Button>
                <div className="text-center text-xs text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Space</kbd> to reveal answer
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  How well did you know this?
                </div>
                <div className="text-center text-xs text-muted-foreground mb-3">
                  Press <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">1</kbd>-<kbd className="px-1 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">4</kbd> to rate your performance
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="py-6 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl"
                    onClick={() => handleRating("again")}
                    disabled={isRating}
                  >
                    {isRating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <div className="flex flex-col items-center">
                      <span>Again</span>
                      <span className="text-xs opacity-75">(1)</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="py-6 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl"
                    onClick={() => handleRating("hard")}
                    disabled={isRating}
                  >
                    {isRating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <div className="flex flex-col items-center">
                      <span>Hard</span>
                      <span className="text-xs opacity-75">(2)</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="py-6 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl"
                    onClick={() => handleRating("good")}
                    disabled={isRating}
                  >
                    {isRating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    )}
                    <div className="flex flex-col items-center">
                      <span>Good</span>
                      <span className="text-xs opacity-75">(3)</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="py-6 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl"
                    onClick={() => handleRating("easy")}
                    disabled={isRating}
                  >
                    {isRating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <div className="flex flex-col items-center">
                      <span>Easy</span>
                      <span className="text-xs opacity-75">(4)</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
