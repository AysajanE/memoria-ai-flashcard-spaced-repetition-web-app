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