// File: nextjs-app/db/schema/users.ts

import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), // Added withTimezone for consistency if your DB uses it
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(), // Added withTimezone for consistency if your DB uses it

  // AI & Subscription related
  aiCreditsRemaining: integer('ai_credits_remaining').default(10).notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').default('free').notNull(),

  // Study Stats
  dailyStudyCount: integer('daily_study_count').default(0).notNull(),
  weeklyStudyCount: integer('weekly_study_count').default(0).notNull(),
  totalReviews: integer('total_reviews').default(0).notNull(), // <-- ADDED THIS LINE
  totalCorrectReviews: integer('total_correct_reviews').default(0).notNull(), // <-- ADDED THIS LINE
  consecutiveStudyDays: integer('consecutive_study_days').default(0).notNull(),
  lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }), // Added withTimezone for consistency if your DB uses it
});