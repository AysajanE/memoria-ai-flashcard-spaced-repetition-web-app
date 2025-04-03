/**
 * @file drizzle.config.ts
 * @description 
 *  Drizzle ORM configuration file for Next.js app.
 *  Defines how the migrations are generated and applied, referencing schema definitions.
 *
 * Key points:
 *  - Points to our main schema index in ./db/schema/index.ts
 *  - Outputs migrations to ./db/migrations
 *  - Loads DATABASE_URL from .env.local
 *
 * Usage:
 *  - `npm run db:generate` uses this config to generate migration files
 *  - `npm run db:migrate` applies the generated migrations
 */

import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is not set or not accessible in .env.local"
  );
}

export default {
  schema: "./db/schema/index.ts", // Path to Drizzle schema definitions
  out: "./db/migrations",         // Where new migrations will be placed
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
