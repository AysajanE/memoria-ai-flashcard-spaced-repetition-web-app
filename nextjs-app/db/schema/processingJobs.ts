import { pgTable, text, timestamp, jsonb, pgEnum, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Define a PostgreSQL enum for job status
export const jobStatus = pgEnum('job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// Define a PostgreSQL enum for job type
export const jobType = pgEnum('job_type', [
  'summarize',
  'generate-prompts',
  'generate-cards',
]);

export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  status: jobStatus('status').notNull().default('pending'),
  jobType: jobType('job_type').notNull(),
  inputPayload: jsonb('input_payload').notNull(),
  resultPayload: jsonb('result_payload'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}); 