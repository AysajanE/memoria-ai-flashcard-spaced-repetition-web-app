#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

// Search for forbidden imports in TypeScript/JavaScript files
// Exclude this script itself and node_modules
const result = spawnSync('rg', [
  '-n',
  '--type=typescript',
  '--type=js',
  '@/app/db',
  '.',
  '--glob=!scripts/verify-no-app-db-imports.mjs',
  '--glob=!node_modules/**'
], { stdio: 'inherit' });

if (result.status === 0) {
  console.error('Error: Found forbidden @/app/db imports');
  process.exit(1);
} else {
  console.log('✓ No forbidden @/app/db imports found');
  process.exit(0);
}