import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not defined in .env.local');
  process.exit(1);
}

console.log('Connecting to database...');

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

console.log('Checking users table...');

try {
  // Query the users table
  const result = await sql`SELECT * FROM users`;
  console.log('Users in database:');
  console.log(result);
} catch (error) {
  console.error('Error querying users:', error);
} finally {
  await sql.end();
  console.log('Database connection closed');
} 