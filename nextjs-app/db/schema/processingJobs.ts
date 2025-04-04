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
// Ensure 'generate-cards' is included if it wasn't before
export const jobType = pgEnum('job_type', [
  'summarize', // Keep existing if needed
  'generate-prompts', // Keep existing if needed
  'generate-cards', // Add if missing, ensure it exists
]);

export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .defaultRandom(), // Use defaultRandom or default(gen_random_uuid()) based on migration 0002
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'set null' }), // Can be null if user is deleted
  status: jobStatus('status').notNull().default('pending'),
  jobType: jobType('job_type').notNull(), // Make sure 'generate-cards' is a valid value in the enum above
  inputPayload: jsonb('input_payload').notNull(),
  resultPayload: jsonb('result_payload'), // Stores successful results
  errorMessage: text('error_message'), // Simple error message string
  errorDetail: jsonb('error_detail'), // **FIX:** Added detailed error object column (nullable)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }), // Timestamp when job finished (success or fail)
});