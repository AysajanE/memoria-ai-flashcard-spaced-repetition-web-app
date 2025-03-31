/**
 * @file db.ts
 * @description
 *  Drizzle client instance for Next.js app.
 *  Connects to Postgres using "postgres" library, referencing environment variable.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Initialize Postgres client with 'prepare' disabled for Transaction mode
const client = postgres(databaseUrl, { prepare: false });

export const db = drizzle(client, { schema });
