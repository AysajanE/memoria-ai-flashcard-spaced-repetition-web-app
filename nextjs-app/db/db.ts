import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get database URL from environment variable instead of using dotenv
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(databaseUrl, { prepare: false });
export const db = drizzle(client, { schema }); 