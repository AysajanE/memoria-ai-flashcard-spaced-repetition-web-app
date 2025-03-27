import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const runMigrate = async () => {
  const migrationClient = postgres(databaseUrl, { max: 1 }); // Use separate client for migrations
  const db = drizzle(migrationClient);

  console.log('⏳ Running migrations...');
  const start = Date.now();

  try {
    await migrate(db, { migrationsFolder: './db/migrations' });
    const end = Date.now();
    console.log(`✅ Migrations completed in ${end - start}ms`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end(); // Ensure client connection is closed
  }
};

runMigrate(); 