# SRS Algorithm Consolidation

This document describes the changes made to consolidate the Spaced Repetition System (SRS) algorithm implementation.

## Issue

The codebase had duplicate implementations of the SRS algorithm:

1. `/nextjs-app/lib/srs.ts`
2. `/nextjs-app/src/lib/srs.ts`

Both were nearly identical but located in different directories, which could lead to:
- Inconsistent behavior if one implementation was updated but not the other
- Confusion during development about which implementation to use
- Possible divergence in algorithm behavior over time

## Analysis

Both implementations were well-documented and contained the same core algorithm based on Anki's SM-2 variant. The algorithm handles:

- Learning phase for new cards (interval = 0)
- Review phase with interval adjustments based on difficulty ratings
- Ease factor adjustments to personalize the learning experience
- Due date calculations for scheduling reviews

The `src/actions/study.ts` file was importing from `@/lib/srs`, which could resolve to either implementation depending on path resolution.

## Changes Made

1. **Established a Canonical Implementation**
   - Selected `/nextjs-app/src/lib/srs.ts` as the canonical implementation
   - This aligns with the pattern of placing primary code in the `/src` directory

2. **Created Symbolic Links**
   - Removed the duplicate file at `/nextjs-app/lib/srs.ts`
   - Created a symbolic link from `/nextjs-app/lib/srs.ts` to `/nextjs-app/src/lib/srs.ts`
   - This maintains backward compatibility for any imports using `@/lib/srs`

3. **Maintained Documentation**
   - Preserved the comprehensive documentation within the SRS implementation
   - This ensures developers understand the algorithm's design and functionality

## Benefits

1. **Single Source of Truth**: All SRS calculations now come from a single implementation
2. **Future Maintainability**: Updates to the algorithm only need to be made in one place
3. **Consistency**: Ensures all flashcards are scheduled using the same algorithm
4. **Backward Compatibility**: Existing imports continue to work through symbolic links

## SRS Algorithm Overview

The implemented algorithm is based on the SuperMemo 2 (SM-2) algorithm as modified by Anki:

1. **Learning Phase** (interval = 0):
   - Again → 0 days (immediate review)
   - Hard → 1 day
   - Good → 1 day
   - Easy → 3 days

2. **Review Phase** (interval > 0):
   - Again → Reset to learning phase
   - Hard → interval * 1.2
   - Good → interval * easeFactor
   - Easy → interval * easeFactor * 1.3

3. **Ease Factor Adjustments**:
   - Again: -0.20
   - Hard: -0.15
   - Good: no change
   - Easy: +0.15
   - Bounded between 1.3 and 2.5

The algorithm creates an optimized review schedule that adapts to the learner's performance, focusing repetition on difficult items while spacing out reviews of easier items.