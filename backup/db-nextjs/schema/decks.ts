import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const decks = pgTable('decks', {
  id: text('id').primaryKey().default(sql`uuid_generate_v4()`), // UUID
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