/**
 * @file decks.ts
 * @description
 *  Drizzle schema for the "decks" table.
 *  Stores user's named collections of flashcards.
 *
 * Key columns:
 *  - id (uuid) with default: uuid_generate_v4()
 *  - userId references users.id onDelete: CASCADE
 *  - name: deck name
 *  - createdAt / updatedAt: timestamps
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { sql } from "drizzle-orm";

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("decks_user_id_idx").on(table.userId),
  })
);
