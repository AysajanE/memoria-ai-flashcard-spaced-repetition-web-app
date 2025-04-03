/**
 * @file queries.ts
 * @description
 *  Sets up the Drizzle ORM query builder for each schema table.
 *  This enables the use of db.query.tableName syntax for type-safe queries.
 */

import { pgTable } from 'drizzle-orm/pg-core';
import { createPgSelect } from 'drizzle-orm/pg-core/query-builders/select';
import { createPgInsert } from 'drizzle-orm/pg-core/query-builders/insert';
import { createPgDelete } from 'drizzle-orm/pg-core/query-builders/delete';
import { createPgUpdate } from 'drizzle-orm/pg-core/query-builders/update';
import { users, decks, flashcards, processingJobs } from './schema';
import { drizzle } from 'drizzle-orm/postgres-js';

// This function creates a query builder for a given table
export const createTableQueryBuilder = <T extends ReturnType<typeof pgTable>>(table: T) => ({
  findFirst: (args?: Parameters<ReturnType<typeof createPgSelect<T>>['findFirst']>[0]) => 
    createPgSelect(table).findFirst(args),
  findMany: (args?: Parameters<ReturnType<typeof createPgSelect<T>>['findMany']>[0]) => 
    createPgSelect(table).findMany(args),
  insert: createPgInsert(table),
  update: createPgUpdate(table),
  delete: createPgDelete(table),
});

// Export query builders for each table
export const queries = {
  users: createTableQueryBuilder(users),
  decks: createTableQueryBuilder(decks),
  flashcards: createTableQueryBuilder(flashcards),
  processingJobs: createTableQueryBuilder(processingJobs),
};
