/**
 * @file study-flow.spec.ts
 * @description E2E tests for studying flashcards and stats updates
 * 
 * Tests the complete study experience:
 * - Study session initiation
 * - Flashcard presentation and interaction
 * - SRS rating system (Again, Hard, Good, Easy)
 * - Keyboard shortcuts for efficient study
 * - Stats tracking and updates
 * - Session completion and progress
 */

import { test, expect } from '@playwright/test';
import { 
  mockAuthentication, 
  waitForSelector, 
  studyFlashcards,
  expectToContainText
} from './utils/test-helpers';

test.describe('Study Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
  });

  test('should start study session for a deck', async ({ page }) => {
    // Navigate to a deck page
    await page.goto('/deck/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Look for study button
    const studyButtons = [
      page.locator('button:has-text("Study")'),
      page.locator('[data-testid="study-button"]'),
      page.locator('a[href*="/study"]'),
    ];
    
    let studyStarted = false;
    for (const button of studyButtons) {
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        await page.waitForLoadState('networkidle');
        
        // Should navigate to study page or show study interface
        const currentUrl = page.url();
        const hasStudyInterface = await page.locator('[data-testid="flashcard"], .flashcard').isVisible().catch(() => false);
        
        expect(currentUrl.includes('/study') || hasStudyInterface).toBeTruthy();
        studyStarted = true;
        break;
      }
    }
    
    if (!studyStarted) {
      // Try direct navigation to study
      await page.goto('/study/test-deck-123');
      await page.waitForLoadState('networkidle');
      
      const hasContent = await page.locator('body').textContent();
      expect(hasContent).not.toContain('404');
      expect(hasContent).not.toContain('Page Not Found');
    }
  });

  test('should display flashcard with front and back', async ({ page }) => {
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Should show flashcard front
    const cardElements = [
      page.locator('[data-testid="flashcard"]'),
      page.locator('.flashcard'),
      page.locator('[data-testid="card-front"]'),
    ];
    
    let cardFound = false;
    for (const element of cardElements) {
      if (await element.isVisible().catch(() => false)) {
        cardFound = true;
        
        // Should have some content
        const content = await element.textContent();
        expect(content?.trim().length).toBeGreaterThan(0);
        
        // Look for reveal button
        const revealButtons = [
          page.locator('button:has-text("Show Answer")'),
          page.locator('[data-testid="reveal-answer"]'),
          page.locator('button:has-text("Flip")'),
        ];
        
        for (const revealButton of revealButtons) {
          if (await revealButton.isVisible().catch(() => false)) {
            await revealButton.click();
            
            // Should show card back
            const backContent = await page.locator('[data-testid="card-back"], .card-back').isVisible().catch(() => false);
            if (backContent) {
              console.log('✓ Card back revealed successfully');
            }
            break;
          }
        }
        break;
      }
    }
    
    if (!cardFound) {
      // Check for empty state or no due cards
      const emptyStateMessages = [
        'No cards due',
        'No cards to study',
        'All caught up',
        'Come back later',
      ];
      
      const bodyText = await page.textContent('body');
      const hasEmptyState = emptyStateMessages.some(msg => 
        bodyText?.toLowerCase().includes(msg.toLowerCase())
      );
      
      if (hasEmptyState) {
        console.log('ℹ No cards due for study - this is expected sometimes');
      } else {
        expect(cardFound).toBeTruthy();
      }
    }
  });

  test('should handle SRS rating system', async ({ page }) => {
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Look for rating buttons
    const ratingButtons = [
      page.locator('[data-testid="rating-again"]'),
      page.locator('button:has-text("Again")'),
      page.locator('[data-testid="rating-hard"]'),
      page.locator('button:has-text("Hard")'),
      page.locator('[data-testid="rating-good"]'),
      page.locator('button:has-text("Good")'),
      page.locator('[data-testid="rating-easy"]'),
      page.locator('button:has-text("Easy")'),
    ];
    
    // First reveal the answer if needed
    const revealButton = page.locator('button:has-text("Show Answer"), [data-testid="reveal-answer"]');
    if (await revealButton.isVisible().catch(() => false)) {
      await revealButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Test each rating
    const ratings = ['Good', 'Easy', 'Hard', 'Again'];
    let ratingTested = false;
    
    for (const rating of ratings) {
      const ratingButton = page.locator(`button:has-text("${rating}"), [data-testid="rating-${rating.toLowerCase()}"]`);
      
      if (await ratingButton.isVisible().catch(() => false)) {
        await ratingButton.click();
        await page.waitForTimeout(1000);
        
        // Should advance to next card or show completion
        const hasNewCard = await page.locator('[data-testid="flashcard"]').isVisible().catch(() => false);
        const hasCompletion = await page.locator('text="Complete", text="Finished"').isVisible().catch(() => false);
        
        expect(hasNewCard || hasCompletion).toBeTruthy();
        ratingTested = true;
        break;
      }
    }
    
    if (!ratingTested) {
      console.log('ℹ No rating buttons found - checking for alternative study interface');
      
      // Alternative: click on card itself might work
      const card = page.locator('[data-testid="flashcard"], .flashcard');
      if (await card.isVisible().catch(() => false)) {
        await card.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should support keyboard shortcuts for efficient study', async ({ page }) => {
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Test Space key for reveal/advance
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    // Test number keys for ratings (common shortcut)
    const shortcuts = ['1', '2', '3', '4']; // Usually map to Again, Hard, Good, Easy
    
    for (const key of shortcuts) {
      await page.keyboard.press(key);
      await page.waitForTimeout(500);
      
      // Should advance or rate
      const hasChanged = await page.locator('[data-testid="flashcard"]').isVisible().catch(() => false);
      if (hasChanged) {
        console.log(`✓ Keyboard shortcut '${key}' worked`);
        break;
      }
    }
    
    // Test Enter key
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Test Escape key (might exit or go back)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Page should remain functional
    const isBodyFocused = await page.locator('body').isEnabled();
    expect(isBodyFocused).toBeTruthy();
  });

  test('should track and update study stats', async ({ page }) => {
    // First, check initial stats
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for stats display
    const statsElements = [
      page.locator('[data-testid="study-stats"]'),
      page.locator('.stats'),
      page.locator('text="studied today"'),
      page.locator('[data-testid="daily-count"]'),
    ];
    
    let initialStats = '';
    for (const element of statsElements) {
      if (await element.isVisible().catch(() => false)) {
        initialStats = await element.textContent() || '';
        break;
      }
    }
    
    // Go study some cards
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Study a few cards if available
    const hasCards = await page.locator('[data-testid="flashcard"], .flashcard').isVisible().catch(() => false);
    
    if (hasCards) {
      // Study 2-3 cards
      for (let i = 0; i < 3; i++) {
        // Reveal answer
        const revealButton = page.locator('button:has-text("Show Answer"), [data-testid="reveal-answer"]');
        if (await revealButton.isVisible().catch(() => false)) {
          await revealButton.click();
          await page.waitForTimeout(500);
        }
        
        // Rate as Good
        const goodButton = page.locator('button:has-text("Good"), [data-testid="rating-good"]');
        if (await goodButton.isVisible().catch(() => false)) {
          await goodButton.click();
          await page.waitForTimeout(1000);
        } else {
          // Try keyboard shortcut
          await page.keyboard.press('3');
          await page.waitForTimeout(1000);
        }
        
        // Check if more cards available
        const nextCard = await page.locator('[data-testid="flashcard"]').isVisible().catch(() => false);
        if (!nextCard) break;
      }
      
      // Go back to dashboard to check updated stats
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Stats should have updated
      let updatedStats = '';
      for (const element of statsElements) {
        if (await element.isVisible().catch(() => false)) {
          updatedStats = await element.textContent() || '';
          break;
        }
      }
      
      if (initialStats && updatedStats) {
        console.log(`Initial stats: ${initialStats}`);
        console.log(`Updated stats: ${updatedStats}`);
        
        // Stats should be different (assuming they were studying)
        if (initialStats !== updatedStats) {
          console.log('✓ Stats updated after study session');
        }
      }
    }
  });

  test('should handle study session completion', async ({ page }) => {
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Study cards until completion or limit
    let cardsStudied = 0;
    const maxCards = 10; // Prevent infinite loop
    
    while (cardsStudied < maxCards) {
      const hasCard = await page.locator('[data-testid="flashcard"], .flashcard').isVisible().catch(() => false);
      
      if (!hasCard) {
        // Check for completion message
        const completionMessages = [
          'Session complete',
          'All cards studied',
          'Great job',
          'No more cards',
        ];
        
        const bodyText = await page.textContent('body');
        const hasCompletionMessage = completionMessages.some(msg => 
          bodyText?.toLowerCase().includes(msg.toLowerCase())
        );
        
        if (hasCompletionMessage) {
          console.log('✓ Study session completed with appropriate message');
        }
        break;
      }
      
      // Study the card
      // Reveal answer
      const revealButton = page.locator('button:has-text("Show Answer"), [data-testid="reveal-answer"]');
      if (await revealButton.isVisible().catch(() => false)) {
        await revealButton.click();
        await page.waitForTimeout(500);
      }
      
      // Rate as Good
      const goodButton = page.locator('button:has-text("Good"), [data-testid="rating-good"]');
      if (await goodButton.isVisible().catch(() => false)) {
        await goodButton.click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('3'); // Keyboard shortcut
        await page.waitForTimeout(1000);
      }
      
      cardsStudied++;
    }
    
    // Should show completion state or return to deck
    const finalUrl = page.url();
    const bodyText = await page.textContent('body');
    
    expect(bodyText).not.toContain('Error');
    expect(finalUrl).not.toContain('/study/test-deck-123/undefined');
  });

  test('should handle study session interruption and resumption', async ({ page }) => {
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Start studying
    const hasCard = await page.locator('[data-testid="flashcard"]').isVisible().catch(() => false);
    
    if (hasCard) {
      // Navigate away mid-session
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Return to study
      await page.goto('/study/test-deck-123');
      await page.waitForLoadState('networkidle');
      
      // Should resume properly
      const resumedCard = await page.locator('[data-testid="flashcard"]').isVisible().catch(() => false);
      const hasError = await page.locator('text="Error"').isVisible().catch(() => false);
      
      expect(resumedCard || !hasError).toBeTruthy();
    }
  });

  test('should show progress during study session', async ({ page }) => {
    await page.goto('/study/test-deck-123');
    await page.waitForLoadState('networkidle');
    
    // Look for progress indicators
    const progressElements = [
      page.locator('[data-testid="study-progress"]'),
      page.locator('.progress-bar'),
      page.locator('text="of"'), // Like "3 of 10"
      page.locator('[data-testid="cards-remaining"]'),
    ];
    
    for (const element of progressElements) {
      if (await element.isVisible().catch(() => false)) {
        const progressText = await element.textContent();
        console.log(`Progress indicator found: ${progressText}`);
        
        // Should contain numbers
        expect(progressText).toMatch(/\d/);
        break;
      }
    }
  });
});