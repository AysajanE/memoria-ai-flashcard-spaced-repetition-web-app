import { submitTextForCardsAction } from "@/actions/ai";

const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!inputText.trim()) return;

  startTransition(async () => {
    const actionResult = await submitTextForCardsAction(inputText);
    
    if (!actionResult.isSuccess) {
      toast({
        title: "Error",
        description: actionResult.message || "Failed to submit text for processing.",
        variant: "destructive",
      });
    }
  });
}; 