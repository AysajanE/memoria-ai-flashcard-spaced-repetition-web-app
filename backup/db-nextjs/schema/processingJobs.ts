import { pgTable, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);
export const jobTypeEnum = pgEnum('job_type', ['generate-cards']);

export const processingJobs = pgTable('processing_jobs', {
  id: text('id').primaryKey().default(sql`uuid_generate_v4()`),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: jobStatusEnum('status').default('pending').notNull(),
  jobType: jobTypeEnum('job_type').default('generate-cards').notNull(), // AI card generation
  inputPayload: jsonb('input_payload').notNull(),
  resultPayload: jsonb('result_payload'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => {
  return {
    userIdIdx: index('processing_jobs_user_id_idx').on(table.userId),
  }
}); 