import { relations } from 'drizzle-orm';
import { users } from './users';
import { decks } from './decks';
import { flashcards } from './flashcards';
import { processingJobs } from './processingJobs';

export const usersRelations = relations(users, ({ many }) => ({
  decks: many(decks),
  flashcards: many(flashcards),
  processingJobs: many(processingJobs),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, {
    fields: [decks.userId],
    references: [users.id],
  }),
  flashcards: many(flashcards),
}));

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

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  user: one(users, {
    fields: [processingJobs.userId],
    references: [users.id],
  }),
})); 