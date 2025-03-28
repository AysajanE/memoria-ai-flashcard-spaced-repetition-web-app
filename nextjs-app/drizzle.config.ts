/* FILE: nextjs-app/drizzle.config.ts */
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is not set or not accessible in .env.local"
  );
}

export default {
  schema: "./src/db/schema/index.ts", // Path to schema index
  out: "./src/db/migrations", // Path for output migrations
  dialect: "postgresql", // Dialect is postgresql
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
} satisfies Config;
