import { getDecksAction } from "@/actions/db/decks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DecksPage() {
  const decksResult = await getDecksAction();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Your Decks</h1>
      
      {!decksResult.isSuccess ? (
        <div className="text-red-500">
          {decksResult.message || "Failed to load decks"}
        </div>
      ) : decksResult.data.length === 0 ? (
        <div className="text-muted-foreground">
          You haven't created any decks yet. Create some flashcards first!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decksResult.data.map((deck) => (
            <Link key={deck.id} href={`/study/${deck.id}`}>
              <Card className="h-full hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <CardTitle>{deck.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full">
                    Study
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
} 