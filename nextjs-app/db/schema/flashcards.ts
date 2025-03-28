import { pgTable, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { decks } from './decks';
import { processingJobs } from './processingJobs';

export const cardTypeEnum = pgEnum('card_type', ['basic', 'cloze']);

export const flashcards = pgTable('flashcards', {
  id: text('id').primaryKey().defaultRandom(), // UUID
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  deckId: text('deck_id').references(() => decks.id, { onDelete: 'cascade' }),
  jobId: text('job_id').references(() => processingJobs.id, { onDelete: 'set null' }),
  front: text('front').notNull(),
  back: text('back'),
  type: cardTypeEnum('type').default('basic').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('flashcards_user_id_idx').on(table.userId),
    deckIdIdx: index('flashcards_deck_id_idx').on(table.deckId),
    jobIdIdx: index('flashcards_job_id_idx').on(table.jobId),
  }
}); 