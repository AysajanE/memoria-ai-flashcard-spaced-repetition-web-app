import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(databaseUrl, { prepare: false });
export const db = drizzle(client, { schema }); 