export type ActionState<TData = undefined> = {
  isSuccess: boolean;
  message?: string | null;
  error?: Record<string, string[]> | null; // For form field errors
  data?: TData;
};

export interface FlashcardData {
  front: string;
  back: string;
  type?: 'qa' | 'cloze';
}

export interface Deck {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Flashcard {
  id: string;
  deckId: string;
  userId: string;
  front: string;
  back: string;
  cardType: 'qa' | 'cloze';
  srsLevel: number;
  srsInterval: number;
  srsEaseFactor: number;
  srsDueDate: Date;
  createdAt: Date;
  updatedAt: Date;
} 