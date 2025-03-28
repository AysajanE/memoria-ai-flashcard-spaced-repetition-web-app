import { pgTable, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);
export const jobTypeEnum = pgEnum('job_type', ['generate-cards']);

export const processingJobs = pgTable('processing_jobs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  status: jobStatusEnum('status').default('pending').notNull(),
  jobType: jobTypeEnum('job_type').default('generate-cards').notNull(), // AI card generation
  inputPayload: jsonb('input_payload').notNull(),
  resultPayload: jsonb('result_payload'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}); 