---
title: Understanding the Anki Algorithm
description: A deep dive into how Anki's spaced repetition algorithm works and how to optimize your learning with it.
---

# Understanding the Anki Algorithm

The Anki algorithm is a sophisticated implementation of spaced repetition that helps you learn and retain information effectively. This article explains how it works and how to use it to your advantage.

## Core Components

### 1. Intervals
- **Initial**: First review after 1 day
- **Graduating**: Moves to "Graduated" after first successful review
- **Relearning**: Resets to 1 day if you fail a review

### 2. Ease Factor
- Starts at 250% (2.5)
- Adjusts based on your performance
- Affects how quickly intervals grow

### 3. Steps
- **New Cards**: Learning steps (e.g., 1 10)
- **Graduated Cards**: Review intervals

## How the Algorithm Works

1. **New Card Learning**:
   - First step: 1 minute
   - Second step: 10 minutes
   - Third step: 1 day
   - After completing steps: Card graduates

2. **Review Process**:
   - Success: Interval = Previous Interval × Ease Factor
   - Hard: Interval = Previous Interval × 1.2
   - Again: Resets to relearning steps

3. **Ease Factor Adjustment**:
   - Good: Stays the same
   - Hard: Decreases by 15%
   - Again: Decreases by 20%

## Optimizing Your Learning

### Best Practices

1. **Consistent Ratings**:
   - "Again": Complete blackout
   - "Hard": Remembered with difficulty
   - "Good": Remembered with effort
   - "Easy": Remembered instantly

2. **Card Creation**:
   - Keep cards simple
   - One concept per card
   - Use clear language
   - Include context

3. **Review Strategy**:
   - Review daily
   - Don't skip reviews
   - Be honest with ratings
   - Keep ease factors stable

## Common Pitfalls

1. **Rating Inconsistency**:
   - Using "Easy" too often
   - Not using "Again" when needed
   - Inconsistent "Hard" ratings

2. **Card Design Issues**:
   - Too much information
   - Ambiguous questions
   - Missing context
   - Poor formatting

3. **Review Habits**:
   - Skipping days
   - Binge reviewing
   - Not maintaining daily limits

## Advanced Tips

1. **Interval Modifier**:
   - Adjusts all intervals
   - Useful for different subjects
   - Can be set per deck

2. **Maximum Interval**:
   - Caps longest interval
   - Default is 36500 days (100 years)
   - Consider adjusting based on needs

3. **Starting Ease**:
   - Default is 250%
   - Lower for difficult material
   - Higher for easy material

## Conclusion

Understanding the Anki algorithm helps you make better decisions about your learning. Remember that the algorithm is a tool - your success depends on consistent, honest use of the system. 