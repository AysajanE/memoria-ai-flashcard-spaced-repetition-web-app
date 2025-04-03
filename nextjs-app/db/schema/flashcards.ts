import { pgTable, text, timestamp, integer, numeric, uuid } from 'drizzle-orm/pg-core';
import { cardTypes } from './cardTypes';
import { users } from './users';
import { decks } from './decks';

export const flashcards = pgTable('flashcards', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  front: text('front').notNull(),
  back: text('back').notNull(),
  cardType: cardTypes('card_type').notNull().default('qa'),
  srsLevel: integer('srs_level').notNull().default(0),
  srsInterval: integer('srs_interval').notNull().default(0),
  srsEaseFactor: numeric('srs_ease_factor', { precision: 4, scale: 2 }).notNull().default('2.50'),
  srsDueDate: timestamp('srs_due_date', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}); 