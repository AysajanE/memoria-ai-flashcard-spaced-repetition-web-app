import { submitTextForCardsAction } from "@/actions/ai";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function CreatePage() {
  const [isPending, startTransition] = useTransition();
  const [inputText, setInputText] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      toast.error("Please enter some text to generate cards from");
      return;
    }

    startTransition(async () => {
      const actionResult = await submitTextForCardsAction(inputText);
      
      if (!actionResult.isSuccess) {
        toast.error(actionResult.message || "Failed to submit text for processing");
        if (actionResult.error) {
          // Display validation errors
          Object.entries(actionResult.error).forEach(([field, messages]) => {
            toast.error(`${field}: ${messages.join(", ")}`);
          });
        }
      }
    });
  };

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Create Flashcards</h1>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="input-text" className="text-sm font-medium">
            Enter your text
          </label>
          <textarea
            id="input-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full min-h-[200px] p-3 rounded-md border"
            placeholder="Paste your text here..."
            disabled={isPending}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Generate Flashcards"
          )}
        </button>
      </form>
    </div>
  );
} 