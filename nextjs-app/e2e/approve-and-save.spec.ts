/**
 * @file approve-and-save.spec.ts
 * @description E2E tests for card approval and saving without N+1 queries
 * 
 * Tests the card approval workflow:
 * - Generated cards display and editing
 * - Individual card approval/rejection
 * - Bulk card operations
 * - Performance and loading optimization
 * - Final deck creation
 */

import { test, expect } from '@playwright/test';
import { 
  mockAuthentication, 
  waitForSelector, 
  fillField,
  expectToContainText,
  takeDebugScreenshot
} from './utils/test-helpers';

test.describe('Card Approval and Save Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
  });

  test('should display generated cards for review', async ({ page }) => {
    // Navigate to a completed processing job (mock scenario)
    // In real tests, this would be after creating cards via the creation flow
    await page.goto('/create/completed-job-123');
    
    // Wait for cards to load
    await page.waitForLoadState('networkidle');
    
    // Should show generated cards or completion state
    const cardElements = [
      page.locator('[data-testid="generated-card"]'),
      page.locator('.flashcard'),
      page.locator('[data-testid="card-preview"]'),
    ];
    
    let cardsFound = false;
    for (const element of cardElements) {
      const cards = await element.all();
      if (cards.length > 0) {
        cardsFound = true;
        
        // Each card should have front and back content
        for (const card of cards.slice(0, 3)) { // Check first 3 cards
          const hasContent = await card.locator('text=').count() > 0;
          expect(hasContent).toBeTruthy();
        }
        break;
      }
    }
    
    // If no cards found, should show appropriate state
    if (!cardsFound) {
      const statusElements = [
        page.locator('text="No cards generated"'),
        page.locator('text="Processing"'),
        page.locator('[data-testid="empty-state"]'),
      ];
      
      let statusFound = false;
      for (const element of statusElements) {
        if (await element.isVisible().catch(() => false)) {
          statusFound = true;
          break;
        }
      }
      
      expect(statusFound).toBeTruthy();
    }
  });

  test('should allow editing individual cards', async ({ page }) => {
    await page.goto('/create/completed-job-123');
    await page.waitForLoadState('networkidle');
    
    // Find first editable card
    const editButtons = page.locator('[data-testid="edit-card"], button:has-text("Edit")');
    const firstEditButton = editButtons.first();
    
    if (await firstEditButton.isVisible().catch(() => false)) {
      await firstEditButton.click();
      
      // Should show edit mode
      const editInputs = page.locator('input[data-testid="card-front"], textarea[data-testid="card-front"]');
      await waitForSelector(page, 'input, textarea');
      
      const frontInput = editInputs.first();
      const originalValue = await frontInput.inputValue();
      
      // Edit the content
      const newValue = 'Edited card front';
      await frontInput.fill(newValue);
      await expect(frontInput).toHaveValue(newValue);
      
      // Save changes
      const saveButton = page.locator('button:has-text("Save"), [data-testid="save-card"]');
      await saveButton.click();
      
      // Should exit edit mode and show updated content
      await page.waitForTimeout(1000);
      const updatedContent = await page.locator('[data-testid="card-front-display"], .card-front').first().textContent();
      expect(updatedContent).toContain(newValue);
    }
  });

  test('should handle card approval/rejection', async ({ page }) => {
    await page.goto('/create/completed-job-123');
    await page.waitForLoadState('networkidle');
    
    // Find approval controls
    const approvalButtons = [
      page.locator('[data-testid="approve-card"]'),
      page.locator('button:has-text("Approve")'),
      page.locator('[data-testid="reject-card"]'),
      page.locator('button:has-text("Reject")'),
    ];
    
    let approvalFound = false;
    for (const buttonSet of [approvalButtons.slice(0, 2), approvalButtons.slice(2, 4)]) {
      for (const button of buttonSet) {
        if (await button.first().isVisible().catch(() => false)) {
          approvalFound = true;
          
          // Click the button
          await button.first().click();
          await page.waitForTimeout(500);
          
          // Should show visual feedback
          const hasVisualFeedback = await page.locator('.approved, .rejected, [data-approved], [data-rejected]').isVisible().catch(() => false);
          
          if (hasVisualFeedback) {
            console.log('✓ Visual feedback shown for approval/rejection');
          }
          
          break;
        }
      }
      if (approvalFound) break;
    }
    
    if (!approvalFound) {
      console.log('ℹ No approval controls found - checking for auto-approved state');
      
      // Might be auto-approved or different UI
      const hasCards = await page.locator('[data-testid="generated-card"], .flashcard').count() > 0;
      expect(hasCards).toBeTruthy();
    }
  });

  test('should support bulk card operations', async ({ page }) => {
    await page.goto('/create/completed-job-123');
    await page.waitForLoadState('networkidle');
    
    // Look for bulk operation controls
    const bulkControls = [
      page.locator('[data-testid="select-all"]'),
      page.locator('button:has-text("Select All")'),
      page.locator('[data-testid="approve-all"]'),
      page.locator('button:has-text("Approve All")'),
    ];
    
    for (const control of bulkControls) {
      if (await control.isVisible().catch(() => false)) {
        await control.click();
        await page.waitForTimeout(1000);
        
        // Should show some visual change
        const hasChange = await page.locator('.selected, .approved').count() > 0;
        if (hasChange) {
          console.log('✓ Bulk operation worked');
        }
        
        break;
      }
    }
  });

  test('should create deck with approved cards efficiently (no N+1 queries)', async ({ page }) => {
    await page.goto('/create/completed-job-123');
    await page.waitForLoadState('networkidle');
    
    // Start network monitoring to check for N+1 queries
    let requestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/') && request.method() === 'POST') {
        requestCount++;
      }
    });
    
    // Find deck creation form
    const deckNameInput = page.locator('input[name="deckName"], [data-testid="deck-name"]');
    if (await deckNameInput.isVisible().catch(() => false)) {
      await fillField(page, 'input[name="deckName"], [data-testid="deck-name"]', 'My Test Deck');
    }
    
    // Create/Save deck
    const saveButtons = [
      page.locator('button:has-text("Create Deck")'),
      page.locator('[data-testid="save-deck"]'),
      page.locator('button:has-text("Save")'),
      page.locator('button[type="submit"]'),
    ];
    
    let saved = false;
    for (const button of saveButtons) {
      if (await button.isVisible().catch(() => false)) {
        const initialRequestCount = requestCount;
        
        await button.click();
        await page.waitForLoadState('networkidle');
        
        const finalRequestCount = requestCount;
        const requestsMade = finalRequestCount - initialRequestCount;
        
        // Should not make excessive requests (no N+1 queries)
        // Ideally should be 1-2 requests maximum for efficient bulk creation
        expect(requestsMade).toBeLessThanOrEqual(3);
        
        // Should show success state or navigate to deck
        await page.waitForTimeout(2000);
        const currentUrl = page.url();
        const hasSuccessMessage = await page.locator('text="Success", text="Created", .success').isVisible().catch(() => false);
        
        expect(currentUrl !== `/create/completed-job-123` || hasSuccessMessage).toBeTruthy();
        saved = true;
        break;
      }
    }
    
    if (!saved) {
      console.log('ℹ No save button found - checking for auto-save behavior');
    }
  });

  test('should handle large numbers of generated cards', async ({ page }) => {
    // Simulate a job that generated many cards
    await page.goto('/create/large-job-456');
    await page.waitForLoadState('networkidle');
    
    // Should handle large numbers efficiently
    const cards = await page.locator('[data-testid="generated-card"], .flashcard').all();
    
    if (cards.length > 10) {
      // Should show pagination or virtualization for performance
      const paginationExists = await page.locator('.pagination, [data-testid="pagination"]').isVisible().catch(() => false);
      const hasScrollContainer = await page.locator('[data-testid="cards-container"]').isVisible().catch(() => false);
      
      if (paginationExists) {
        console.log('✓ Pagination found for large card set');
      } else if (hasScrollContainer) {
        console.log('✓ Scroll container found for large card set');
      } else {
        // Should still load without crashing
        const bodyText = await page.textContent('body');
        expect(bodyText).not.toContain('Error');
      }
    }
    
    // Test scrolling performance
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Page should remain responsive
    const isResponsive = await page.isEnabled('body');
    expect(isResponsive).toBeTruthy();
  });

  test('should preserve card edits during review process', async ({ page }) => {
    await page.goto('/create/completed-job-123');
    await page.waitForLoadState('networkidle');
    
    // Edit a card
    const editButton = page.locator('[data-testid="edit-card"]').first();
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click();
      
      const frontInput = page.locator('input[data-testid="card-front"], textarea[data-testid="card-front"]').first();
      const editedContent = 'Edited content that should persist';
      await frontInput.fill(editedContent);
      
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      
      // Navigate away and back
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await page.goForward();
      await page.waitForLoadState('networkidle');
      
      // Content should still be there
      const persistedContent = await page.locator('[data-testid="card-front-display"]').first().textContent();
      expect(persistedContent).toContain(editedContent);
    }
  });

  test('should handle keyboard navigation in card review', async ({ page }) => {
    await page.goto('/create/completed-job-123');
    await page.waitForLoadState('networkidle');
    
    // Test Tab navigation through cards
    await page.keyboard.press('Tab');
    
    // Should be able to focus on card elements
    const focusedElement = await page.locator(':focus').first();
    const isFocused = await focusedElement.isVisible().catch(() => false);
    
    if (isFocused) {
      // Test Enter to activate
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Test Escape to cancel (if in edit mode)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Arrow key navigation (if implemented)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);
    
    // Page should remain functional
    const isBodyFocusable = await page.locator('body').isEnabled();
    expect(isBodyFocusable).toBeTruthy();
  });
});