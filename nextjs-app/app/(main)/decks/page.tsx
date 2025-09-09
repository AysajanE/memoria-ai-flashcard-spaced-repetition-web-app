"use server";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { decks, flashcards } from "@/db/schema";
import { eq, count } from "drizzle-orm";

// Cache the decks data with cache tags for revalidation
// Pass userId as parameter to avoid using auth() inside cache
const getCachedDecksWithCounts = unstable_cache(
  async (userId: string) => {
    // Get all decks for the user with card counts in a single query
    const decksWithCounts = await db
      .select({
        id: decks.id,
        userId: decks.userId,
        name: decks.name,
        createdAt: decks.createdAt,
        updatedAt: decks.updatedAt,
        cardCount: count(flashcards.id),
      })
      .from(decks)
      .leftJoin(flashcards, eq(flashcards.deckId, decks.id))
      .where(eq(decks.userId, userId))
      .groupBy(decks.id, decks.userId, decks.name, decks.createdAt, decks.updatedAt);

    return decksWithCounts;
  },
  ["decks-list"],
  {
    tags: ["decks-list"],
    revalidate: false, // Keep dynamic for now
  }
);

export default async function DecksPage() {
  const { userId } = auth();
  if (!userId) {
    redirect("/sign-in");
  }

  try {
    const decks = await getCachedDecksWithCounts(userId);

    return (
      <div className="container mx-auto py-8">
        <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>

        {decks.length === 0 ? (
          <div className="text-muted-foreground">
            You haven&apos;t created any decks yet. Create some flashcards first!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <Link key={deck.id} href={`/study/${deck.id}`}>
                <Card className="hover:bg-accent/50 h-full transition-colors flex flex-col">
                  <CardHeader>
                    <CardTitle>{deck.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="flex items-center text-muted-foreground mb-4">
                      <BookOpen className="h-4 w-4 mr-2" />
                      <span>{deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="secondary" className="w-full">
                      Study
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("Error fetching decks:", error);
    return (
      <div className="container mx-auto py-8">
        <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-destructive">Failed to load decks</div>
        </div>
      </div>
    );
  }
}