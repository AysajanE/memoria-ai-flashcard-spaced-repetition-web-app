/**
 * @file test-helpers.ts
 * @description Utility functions for E2E tests
 */

import { Page, expect } from '@playwright/test';

// Test constants
export const TEST_USER = {
  email: 'test@example.com',
  password: 'testPassword123!',
};

export const TEST_DECK = {
  name: 'Test Deck',
  description: 'A test deck for E2E tests',
};

export const TEST_CONTENT = `
The Renaissance was a period in European history marking the transition from the Middle Ages to modernity and covering the 15th and 16th centuries.

Key characteristics:
- Renewed interest in classical learning
- Development of linear perspective in painting
- Scientific revolution
- Humanism movement
- Major artists: Leonardo da Vinci, Michelangelo, Raphael
`;

/**
 * Helper to wait for a selector with retry logic
 */
export async function waitForSelector(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Helper to fill form field and wait for it to be filled
 */
export async function fillField(page: Page, selector: string, value: string) {
  await page.fill(selector, value);
  await expect(page.locator(selector)).toHaveValue(value);
}

/**
 * Helper to click and wait for navigation
 */
export async function clickAndWait(page: Page, selector: string, waitForElementSelector?: string) {
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selector),
  ]);
  
  if (waitForElementSelector) {
    await waitForSelector(page, waitForElementSelector);
  }
}

/**
 * Helper to wait for loading states to finish
 */
export async function waitForLoadingToFinish(page: Page) {
  // Wait for any loading spinners to disappear
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[data-testid="loading"], .loading, .spinner');
    return spinners.length === 0;
  }, { timeout: 15000 });
}

/**
 * Helper to simulate authentication (mock for testing)
 * In a real app, you'd use Clerk's testing utilities
 */
export async function mockAuthentication(page: Page) {
  // For demo purposes, we'll navigate to a page that would typically require auth
  // In a real implementation, you'd use Clerk's test helpers to mock authentication
  await page.goto('/');
  
  // Look for sign in button or authenticated state
  const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
  
  if (!isSignedIn) {
    console.log('Note: Authentication mock not implemented - tests may need real auth');
  }
}

/**
 * Helper to create a test deck via UI
 */
export async function createTestDeck(page: Page, deckName = TEST_DECK.name) {
  await page.goto('/');
  
  // Look for create deck button
  const createButton = page.locator('text="Create Deck"').or(page.locator('[data-testid="create-deck-button"]'));
  await createButton.click();
  
  // Fill deck form
  await fillField(page, 'input[name="name"]', deckName);
  await fillField(page, 'textarea[name="description"]', TEST_DECK.description);
  
  // Submit form
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * Helper to wait for AI processing to complete
 */
export async function waitForAiProcessing(page: Page, timeout = 30000) {
  // Wait for processing to start
  await page.waitForSelector('[data-testid="processing-status"]', { timeout: 5000 }).catch(() => {
    console.log('Processing status not found, continuing...');
  });
  
  // Wait for processing to complete
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="processing-status"]');
    return !status || status.textContent?.includes('completed') || status.textContent?.includes('failed');
  }, { timeout });
}

/**
 * Helper to simulate flashcard study session
 */
export async function studyFlashcards(page: Page, cardCount = 3) {
  const ratings = ['Again', 'Hard', 'Good', 'Easy'];
  
  for (let i = 0; i < cardCount; i++) {
    // Wait for card to load
    await waitForSelector(page, '[data-testid="flashcard"]');
    
    // Click to reveal answer
    await page.click('[data-testid="reveal-answer"]');
    
    // Wait for answer to be shown
    await waitForSelector(page, '[data-testid="flashcard-back"]');
    
    // Rate the card
    const rating = ratings[i % ratings.length];
    await page.click(`[data-testid="rating-${rating.toLowerCase()}"]`);
    
    // Wait for next card or completion
    await page.waitForTimeout(1000);
  }
}

/**
 * Helper to check if element contains text
 */
export async function expectToContainText(page: Page, selector: string, text: string) {
  await expect(page.locator(selector)).toContainText(text);
}

/**
 * Helper to take screenshot for debugging
 */
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}-${Date.now()}.png` });
}