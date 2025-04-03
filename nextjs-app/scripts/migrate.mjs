/* FILE: scripts/migrate.mjs */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Client } = pkg;
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set or not accessible in .env.local');
}

// Parse the connection string to extract individual components
const parseConnectionString = (connectionString) => {
  try {
    // Format is typically: postgresql://username:password@hostname:port/database
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.substring(1), // Remove leading slash
      user: url.username,
      password: url.password,
      ssl: url.searchParams.get('ssl') === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  } catch (error) {
    console.error('Failed to parse connection string:', error);
    throw error;
  }
};

const runMigrate = async () => {
  let client;
  try {
    const connectionParams = parseConnectionString(databaseUrl);
    console.log(`Connecting to database ${connectionParams.database} on ${connectionParams.host}:${connectionParams.port} as ${connectionParams.user}`);
    
    // Create a new pg client
    client = new Client(connectionParams);
    await client.connect();
    console.log('Connected to database');
    
    const db = drizzle(client);

    console.log('⏳ Running migrations...');
    const start = Date.now();

    await migrate(db, { migrationsFolder: './db/migrations' });

    const end = Date.now();
    console.log(`✅ Migrations completed in ${end - start}ms`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1); // Exit with error code on failure
  } finally {
    // Ensure client connection is closed even if errors occurred
    if (client) {
      await client.end();
      console.log('Database connection closed.');
    }
  }
};

runMigrate();