/**
 * @file processingJobs.ts
 * @description
 *  Schema for AI job tracking in "processing_jobs".
 *  Each record tracks the status of an AI generation or summarization process.
 */

import {
  pgTable,
  text,
  uuid,
  jsonb,
  timestamp,
  pgEnum,
  index,
  sql,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const jobTypeEnum = pgEnum("job_type", ["generate-cards"]);
export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    jobType: jobTypeEnum("job_type").default("generate-cards").notNull(),
    status: jobStatusEnum("status").default("pending").notNull(),
    inputPayload: jsonb("input_payload").notNull(),
    resultPayload: jsonb("result_payload"),
    errorMessage: text("error_message"),
    errorDetail: jsonb("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("processing_jobs_user_id_idx").on(table.userId),
    statusIdx: index("processing_jobs_status_idx").on(table.status),
  })
);
