"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function StudyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to decks page after a short delay
    const timeout = setTimeout(() => {
      router.push("/decks");
    }, 1500);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="container max-w-2xl py-8">
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <h2 className="text-xl font-semibold">Redirecting to Decks</h2>
          <p className="text-muted-foreground text-center">
            Please select a deck to study from.
          </p>
          <Button onClick={() => router.push("/decks")} className="mt-4">
            Go to Decks
          </Button>
        </div>
      </Card>
    </div>
  );
}