#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

console.log('🔍 Running enhanced import verification...');

const checks = [
  {
    name: 'Forbidden @/app/db imports',
    pattern: '@/app/db',
    fileTypes: ['--type=typescript', '--type=js'],
    description: 'App components should not directly import database schemas'
  },
  {
    name: 'Direct database imports in client components',
    pattern: 'from.*["\']@/db["\']',
    fileTypes: ['--type=typescript'],
    directories: ['components/'],
    description: 'React client components should use server actions instead of direct DB access'
  },
  {
    name: 'Server-only imports in client components',
    pattern: 'from.*["\']fs["\']|from.*["\']path["\']|from.*["\']crypto["\']',
    fileTypes: ['--type=typescript'],
    directories: ['components/'],
    description: 'Client components cannot use Node.js server-only modules'
  }
];

let hasViolations = false;
const violations = [];

for (const check of checks) {
  console.log(`\n📋 Checking: ${check.name}`);
  
  const searchArgs = [
    '-n', // show line numbers
    ...check.fileTypes,
    check.pattern,
  ];
  
  if (check.directories) {
    searchArgs.push(...check.directories);
  } else {
    searchArgs.push('.');
  }
  
  // Add exclusions
  searchArgs.push(
    '--glob=!scripts/**',
    '--glob=!node_modules/**',
    '--glob=!.next/**',
    '--glob=!**/*.test.ts',
    '--glob=!**/*.spec.ts'
  );
  
  const result = spawnSync('rg', searchArgs, { 
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
  
  if (result.status === 0 && result.stdout.trim()) {
    hasViolations = true;
    violations.push({
      check: check.name,
      description: check.description,
      matches: result.stdout.trim().split('\n')
    });
    
    console.log(`❌ Found violations:`);
    console.log(result.stdout);
  } else if (result.stderr && result.stderr.includes('unrecognized')) {
    console.log(`⚠️  Warning: ${result.stderr.trim()}`);
  } else {
    console.log(`✅ No violations found`);
  }
}

// Additional file structure checks
console.log(`\n📁 Checking file structure...`);

const structureChecks = [
  {
    path: 'app/api',
    required: false,
    name: 'API routes directory'
  },
  {
    path: 'lib',
    required: true,
    name: 'Library utilities directory'
  },
  {
    path: 'components',
    required: true,
    name: 'Components directory'
  }
];

for (const structCheck of structureChecks) {
  const exists = existsSync(structCheck.path);
  if (structCheck.required && !exists) {
    console.log(`❌ Missing required directory: ${structCheck.path}`);
    hasViolations = true;
  } else if (exists) {
    console.log(`✅ ${structCheck.name} exists`);
  }
}

// Summary
console.log(`\n📊 Import Verification Summary`);
console.log(`================================`);

if (hasViolations) {
  console.log(`❌ Found ${violations.length} types of violations:`);
  
  for (const violation of violations) {
    console.log(`\n• ${violation.check}`);
    console.log(`  ${violation.description}`);
    console.log(`  ${violation.matches.length} violation(s) found`);
  }
  
  console.log(`\n💡 Fix these issues before building for production.`);
  process.exit(1);
} else {
  console.log(`✅ All import checks passed!`);
  console.log(`🎉 Code follows proper architectural boundaries.`);
  process.exit(0);
}