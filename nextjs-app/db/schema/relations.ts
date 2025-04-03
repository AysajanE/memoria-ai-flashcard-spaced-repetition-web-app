import { relations } from 'drizzle-orm';
import { users } from './users';
import { decks } from './decks';
import { flashcards } from './flashcards';
import { processingJobs } from './processingJobs';

// Define relations for the Users table
export const usersRelations = relations(users, ({ many }) => ({
  decks: many(decks),
  flashcards: many(flashcards),
  processingJobs: many(processingJobs),
}));

// Define relations for the Decks table
export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, {
    fields: [decks.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
}));

// Define relations for the Flashcards table
export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  user: one(users, {
    fields: [flashcards.userId],
    references: [users.id],
  }),
  deck: one(decks, {
    fields: [flashcards.deckId],
    references: [decks.id],
  }),
}));

// Define relations for the ProcessingJobs table
export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  user: one(users, {
    fields: [processingJobs.userId],
    references: [users.id],
  }),
})); 