import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const decks = pgTable('decks', {
  id: text('id').primaryKey().defaultRandom(), // UUID
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('decks_user_id_idx').on(table.userId),
  }
}); 