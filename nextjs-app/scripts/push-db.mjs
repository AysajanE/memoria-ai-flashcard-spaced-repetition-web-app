import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
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

console.log('Pushing schema to database...');

try {
  // Use the migrate function to push the schema
  await migrate(db, { migrationsFolder: resolve(__dirname, '../src/db/migrations') });
  console.log('Schema pushed successfully!');
} catch (error) {
  console.error('Error pushing schema:', error);
} finally {
  await sql.end();
  console.log('Database connection closed');
} 