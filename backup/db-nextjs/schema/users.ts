import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  aiCreditsRemaining: integer('ai_credits_remaining').default(10).notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').default('free').notNull(),
}); 