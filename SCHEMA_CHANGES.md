# Schema Inconsistencies Resolution

This document describes the changes made to fix schema inconsistencies in the database schema.

## Issue

The codebase had multiple schema definitions with different data types:

1. `/db/schema/flashcards.ts`: Used `text` for IDs and 'basic'/'cloze' for card types
2. `/nextjs-app/db/schema/flashcards.ts`: Similar to the above
3. `/nextjs-app/src/db/schema/flashcards.ts`: Used `uuid` for IDs, included SRS fields, and used 'qa'/'cloze' for card types

This inconsistency could lead to:
- Runtime errors when data types don't match
- Confusion during development
- Potential migration issues

## Analysis

After examining the codebase:

1. The drizzle.config.ts was correctly configured to use `/nextjs-app/src/db/schema/index.ts` as the schema source
2. Most imports were using `from "@/db"` which was ambiguous with multiple DB configurations
3. The most complete schema was in `/nextjs-app/src/db/schema/flashcards.ts` with proper SRS fields

## Changes Made

1. **Established a Canonical Schema**
   - Selected `/nextjs-app/src/db/schema` as the canonical schema definition
   - This schema includes the proper SRS fields needed for flashcard spaced repetition

2. **Updated Database Connection**
   - Modified `/nextjs-app/db/db.ts` to import schema from `../src/db/schema`
   - Updated `/nextjs-app/db/index.ts` to re-export the schema

3. **Created Symbolic Links**
   - Removed duplicate `/nextjs-app/db/schema` directory and replaced with symbolic link
   - Set up root-level `/db` as symbolic link to `/nextjs-app/src/db`
   - This ensures any path using `@/db/schema` will get the correct schema

4. **Ensured Import Consistency**
   - Made sure imports in all files are consistent
   - Maintained backward compatibility with existing imports

## Benefits

1. **Single Source of Truth**: All schema definitions now come from a single location
2. **Type Safety**: Consistent types (uuid vs text) for primary keys and relations
3. **Feature Completeness**: Schema now properly includes all required SRS fields
4. **Maintainability**: Easier to update schema when only one definition exists

## Future Considerations

1. **Migration Scripts**: Future migration scripts should be generated from and applied to the canonical schema
2. **Database Validation**: Consider validating the database against the schema on startup
3. **Import Naming**: Standardize import naming conventions across the codebase