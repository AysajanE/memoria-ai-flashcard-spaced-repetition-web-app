export type ActionState<TData = undefined> = {
  isSuccess: boolean;
  message?: string | null;
  error?: Record<string, string[]> | null; // For form field errors
  data?: TData;
};

import { decks, flashcards, users } from "@/db/schema";

// Database entity types (inferred from schema)
export type Deck = typeof decks.$inferSelect;
export type DeckInsert = typeof decks.$inferInsert;
export type Flashcard = typeof flashcards.$inferSelect;
export type FlashcardInsert = typeof flashcards.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// Legacy interface for compatibility
export interface FlashcardData {
  front: string;
  back: string;
  type?: "qa" | "cloze";
} 