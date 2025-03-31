/**
 * @file flashcards.ts
 * @description
 *  Schema for the "flashcards" table.
 *  Each flashcard belongs to a deck and user, with SRS fields for scheduling reviews.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  decimal,
  index,
  sql,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { decks } from "./decks";
import { cardTypeEnum } from "./cardTypes";

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    cardType: cardTypeEnum("card_type").default("qa").notNull(),
    srsLevel: integer("srs_level").default(0).notNull(),
    srsInterval: integer("srs_interval").default(0).notNull(),
    srsEaseFactor: decimal("srs_ease_factor", { precision: 4, scale: 2 })
      .default("2.50")
      .notNull(),
    srsDueDate: timestamp("srs_due_date", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    deckIdIdx: index("flashcards_deck_id_idx").on(table.deckId),
    userIdIdx: index("flashcards_user_id_idx").on(table.userId),
    srsDueDateIdx: index("flashcards_srs_due_date_idx").on(table.srsDueDate),
  })
);
