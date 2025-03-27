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
  const [model, setModel] = useState("gpt-4");
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
        const errorMessage = result.message || "Failed to start card generation";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    });
  };

  return (
    <div className="container max-w-2xl py-8">
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Create Flashcards</h1>
            <p className="text-muted-foreground">
              Enter your text below and we'll generate flashcards using AI.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="text">Input Text</Label>
              <Textarea
                id="text"
                placeholder="Enter the text you want to create flashcards from..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[200px]"
                disabled={isPending}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select value={model} onValueChange={setModel} disabled={isPending}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardType">Card Type</Label>
                <Select value={cardType} onValueChange={setCardType} disabled={isPending}>
                  <SelectTrigger id="cardType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qa">Question & Answer</SelectItem>
                    <SelectItem value="cloze">Cloze Deletion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numCards">Number of Cards</Label>
              <Select value={numCards} onValueChange={setNumCards} disabled={isPending}>
                <SelectTrigger id="numCards">
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} cards
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Cards...
                </>
              ) : (
                "Generate Cards"
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
} 