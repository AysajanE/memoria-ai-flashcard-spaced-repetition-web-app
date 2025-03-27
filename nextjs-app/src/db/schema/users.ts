import { pgTable, text, integer, timestamp, decimal } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk ID
  email: text('email').notNull(),
  aiCreditsRemaining: integer('ai_credits_remaining').default(-1).notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status'),
  dailyStudyCount: integer('daily_study_count').default(0).notNull(),
  weeklyStudyCount: integer('weekly_study_count').default(0).notNull(),
  totalRecallAccuracy: decimal('total_recall_accuracy', { precision: 3, scale: 2 }).default('0.00').notNull(),
  consecutiveStudyDays: integer('consecutive_study_days').default(0).notNull(),
  lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}); 