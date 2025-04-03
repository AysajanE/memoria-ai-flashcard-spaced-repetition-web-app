"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitTextForCardsAction } from "@/actions/ai/submit-text";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function CreatePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [cardType, setCardType] = useState("qa");
  const [numCards, setNumCards] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!text.trim()) {
      setError("Please enter some text to generate cards from");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("model", model);
      formData.append("cardType", cardType);
      formData.append("numCards", numCards);

      const result = await submitTextForCardsAction(formData);

      if (result.isSuccess && result.data?.jobId) {
        toast.success(result.message);
        router.push(`/create/${result.data.jobId}`);
      } else {
        const errorMessage =
          result.message || "Failed to start card generation";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    });
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
          Create Flashcards
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-xl">
          Transform your learning materials into intelligent flashcards in seconds with our AI-powered system.
        </p>
      </div>

      <Card className="p-8 shadow-md border-0 overflow-hidden relative animate-slide-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <Label htmlFor="text" className="text-lg font-medium">Your Learning Material</Label>
            </div>
            <Textarea
              id="text"
              placeholder="Paste your notes, chapters, articles, or any text you want to learn here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[250px] text-base p-4 border-gray-200 dark:border-gray-700 rounded-xl resize-y shadow-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              disabled={isPending}
            />
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>{error}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium">Generation Options</h3>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm font-medium">AI Model</Label>
                <Select
                  value={model}
                  onValueChange={setModel}
                  disabled={isPending}
                >
                  <SelectTrigger id="model" className="w-full border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-1">
                      <SelectItem value="gpt-4o-mini" className="rounded-md focus:bg-indigo-50 dark:focus:bg-indigo-900/20">
                        <div className="flex items-center">
                          <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
                          GPT-4o Mini (Recommended)
                        </div>
                      </SelectItem>
                      <SelectItem value="claude-haiku-3-5-latest" className="rounded-md focus:bg-indigo-50 dark:focus:bg-indigo-900/20">
                        <div className="flex items-center">
                          <div className="mr-2 h-2 w-2 rounded-full bg-blue-500"></div>
                          Claude Haiku (Faster)
                        </div>
                      </SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardType" className="text-sm font-medium">Card Type</Label>
                <Select
                  value={cardType}
                  onValueChange={setCardType}
                  disabled={isPending}
                >
                  <SelectTrigger id="cardType" className="w-full border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-1">
                      <SelectItem value="qa" className="rounded-md focus:bg-indigo-50 dark:focus:bg-indigo-900/20">
                        <div className="flex items-center">
                          <div className="mr-2 h-2 w-2 rounded-full bg-indigo-500"></div>
                          Question & Answer
                        </div>
                      </SelectItem>
                      <SelectItem value="cloze" className="rounded-md focus:bg-indigo-50 dark:focus:bg-indigo-900/20">
                        <div className="flex items-center">
                          <div className="mr-2 h-2 w-2 rounded-full bg-purple-500"></div>
                          Cloze Deletion
                        </div>
                      </SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numCards" className="text-sm font-medium">Number of Cards</Label>
                <Select
                  value={numCards}
                  onValueChange={setNumCards}
                  disabled={isPending}
                >
                  <SelectTrigger id="numCards" className="w-full border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-1 grid grid-cols-2 gap-1">
                      {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((num) => (
                        <SelectItem key={num} value={num.toString()} className="rounded-md focus:bg-indigo-50 dark:focus:bg-indigo-900/20">
                          {num} cards
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isPending} 
            className="w-full py-6 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all border-0 rounded-xl"
          >
            {isPending ? (
              <div className="flex items-center justify-center">
                <div className="relative">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-indigo-300 rounded-full animate-pulse opacity-75"></div>
                </div>
                Generating Your Flashcards...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Flashcards
              </div>
            )}
          </Button>

          {!isPending && (
            <div className="text-sm text-center text-gray-500 dark:text-gray-400">
              Generation usually takes about 15-30 seconds depending on text length
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
