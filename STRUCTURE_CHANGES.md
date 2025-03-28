# Project Structure Consolidation

This document describes the changes made to fix the inconsistent project structure.

## Issue

The codebase had multiple Next.js app directories:
- `/app`: Partial Next.js app with some routes
- `/nextjs-app`: More complete Next.js structure with config files
- `/src/app`: Additional routes

This created confusion, import path issues, and potential circular dependencies.

## Changes Made

1. **Selected Canonical Directory**
   - Chose `/nextjs-app` as the canonical directory since it had the most complete setup
   - Contains proper config files, comprehensive component structure, and package.json

2. **Added Missing Routes**
   - Migrated unique routes from `/app` to `/nextjs-app/app`:
     - Added `/articles` and `/articles/[slug]` pages for educational content
   - Migrated unique routes from `/src/app` to `/nextjs-app/app`:
     - Added `/study/[deckId]` page for flashcard studying

3. **Fixed Import Paths**
   - Updated import paths in the study page to reference the correct files
   - Ensured proper typing by using the existing type definitions

4. **Added Dependencies**
   - Verified the presence of required dependencies
   - Added missing `gray-matter` package for markdown processing

5. **Added Documentation**
   - Created a README.md explaining the project structure and how to run the application
   - Created this STRUCTURE_CHANGES.md document to detail the consolidation process

## Completed Steps

1. **Removal of Duplicate Directories**
   - Created backups of `/app` and `/src/app` directories in `/backup`
   - Removed the duplicate directories
   - Kept only the canonical `/nextjs-app` directory
   - All functionality is now available in the consolidated structure

2. **Updated Import References**
   - Fixed imports in the study page to use the standard pattern (`@/actions/study` instead of `@/src/actions/study`)
   - Created symbolic links from root directory to src subdirectories for better import path consistency:
     - `nextjs-app/actions -> nextjs-app/src/actions`
     - `nextjs-app/types -> nextjs-app/src/types`
   - Ensured the tsconfig.json path mappings correctly handle the imports

3. **Updated Documentation**
   - Updated README.md with clear instructions for the consolidated structure
   - Created this detailed document (STRUCTURE_CHANGES.md) explaining all changes made

4. **Consider Renaming for Clarity**
   - Potentially rename `/nextjs-app` to simply `/app` once all duplicates are removed and references are updated