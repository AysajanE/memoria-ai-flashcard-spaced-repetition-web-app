"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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

export default function CreatePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [cardType, setCardType] = useState("qa");
  const [numCards, setNumCards] = useState("5");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
        toast.error(result.message || "Failed to start card generation");
      }
    });
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Create Flashcards</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="text">Enter your text</Label>
          <Textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here to generate flashcards..."
            className="min-h-[200px]"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardType">Card Type</Label>
            <Select value={cardType} onValueChange={setCardType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qa">Q&A</SelectItem>
                <SelectItem value="cloze">Cloze</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="numCards">Number of Cards</Label>
          <Select value={numCards} onValueChange={setNumCards}>
            <SelectTrigger>
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
          {isPending ? "Generating Cards..." : "Generate Cards"}
        </Button>
      </form>
    </div>
  );
} 