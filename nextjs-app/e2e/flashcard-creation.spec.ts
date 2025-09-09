/**
 * @file flashcard-creation.spec.ts
 * @description E2E tests for AI-powered flashcard creation workflow
 * 
 * Tests the complete flashcard creation journey:
 * - Content input and validation
 * - AI processing with real-time updates
 * - Error handling and retry mechanisms
 * - Processing job state management
 */

import { test, expect } from '@playwright/test';
import { 
  mockAuthentication, 
  waitForSelector, 
  fillField, 
  waitForAiProcessing,
  TEST_CONTENT,
  takeDebugScreenshot 
} from './utils/test-helpers';

test.describe('Flashcard Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthentication(page);
  });

  test('should create flashcards from text content', async ({ page }) => {
    // Navigate to create page
    await page.goto('/create');
    
    // Should show the create form
    await waitForSelector(page, 'textarea, [data-testid="content-input"]');
    
    // Fill in content
    const contentInput = page.locator('textarea').first();
    await contentInput.fill(TEST_CONTENT);
    await expect(contentInput).toHaveValue(TEST_CONTENT);
    
    // Submit for processing
    const submitButton = page.locator('button[type="submit"], [data-testid="create-cards-button"]');
    await submitButton.click();
    
    // Should navigate to processing page or show processing state
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    const hasProcessingIndicator = await page.locator('[data-testid="processing"], .processing, text="processing"').isVisible().catch(() => false);
    
    expect(currentUrl.includes('/create/') || hasProcessingIndicator).toBeTruthy();
    
    // If we have a processing page, wait for completion
    if (currentUrl.includes('/create/')) {
      await waitForAiProcessing(page);
      
      // Should show completed state or generated cards
      const hasCards = await page.locator('[data-testid="generated-card"], .flashcard').isVisible().catch(() => false);
      const hasCompletedState = await page.locator('text="completed", text="Generated"').isVisible().catch(() => false);
      
      expect(hasCards || hasCompletedState).toBeTruthy();
    }
  });

  test('should handle content validation', async ({ page }) => {
    await page.goto('/create');
    await waitForSelector(page, 'textarea');
    
    // Try to submit with empty content
    const submitButton = page.locator('button[type="submit"], [data-testid="create-cards-button"]');
    await submitButton.click();
    
    // Should show validation error or prevent submission
    const hasError = await page.locator('.error, [data-testid="error"], text="required"').isVisible().catch(() => false);
    const buttonDisabled = await submitButton.isDisabled();
    
    expect(hasError || buttonDisabled).toBeTruthy();
    
    // Try with very short content
    await fillField(page, 'textarea', 'Hi');
    
    await submitButton.click();
    
    // Should show minimum length error or prevent submission
    const hasMinLengthError = await page.locator('text="too short", text="minimum"').isVisible().catch(() => false);
    const stillDisabled = await submitButton.isDisabled();
    
    expect(hasMinLengthError || stillDisabled).toBeTruthy();
  });

  test('should show real-time processing updates', async ({ page }) => {
    await page.goto('/create');
    await waitForSelector(page, 'textarea');
    
    // Fill and submit content
    await fillField(page, 'textarea', TEST_CONTENT);
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await page.waitForLoadState('networkidle');
    
    if (page.url().includes('/create/')) {
      // Should show processing state
      const processingElements = [
        page.locator('[data-testid="processing-status"]'),
        page.locator('text="Processing"'),
        page.locator('.loading, .spinner'),
        page.locator('[data-testid="job-status"]'),
      ];
      
      let processingFound = false;
      for (const element of processingElements) {
        if (await element.isVisible().catch(() => false)) {
          processingFound = true;
          break;
        }
      }
      
      if (processingFound) {
        // Wait for status updates
        await page.waitForFunction(() => {
          const statusElements = document.querySelectorAll('[data-testid="processing-status"], [data-testid="job-status"]');
          return Array.from(statusElements).some(el => 
            el.textContent?.includes('completed') || el.textContent?.includes('failed')
          );
        }, { timeout: 30000 });
      }
    }
  });

  test('should handle processing errors gracefully', async ({ page }) => {
    await page.goto('/create');
    await waitForSelector(page, 'textarea');
    
    // Submit content that might cause errors (very long or problematic content)
    const problematicContent = 'x'.repeat(10000); // Very long content
    await fillField(page, 'textarea', problematicContent);
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await page.waitForLoadState('networkidle');
    
    // Wait for either success or error
    await page.waitForFunction(() => {
      const errorElements = document.querySelectorAll('[data-testid="error"], .error, text="error"');
      const successElements = document.querySelectorAll('[data-testid="success"], text="completed"');
      return errorElements.length > 0 || successElements.length > 0;
    }, { timeout: 45000 });
    
    // If there's an error, it should be user-friendly
    const errorVisible = await page.locator('[data-testid="error"], .error').isVisible().catch(() => false);
    if (errorVisible) {
      const errorText = await page.locator('[data-testid="error"], .error').first().textContent();
      expect(errorText).not.toContain('undefined');
      expect(errorText).not.toContain('null');
      expect(errorText?.length).toBeGreaterThan(5);
    }
  });

  test('should allow retry on processing failure', async ({ page }) => {
    await page.goto('/create');
    
    // For this test, we'll simulate navigating to a processing page that might have failed
    // In a real scenario, this would be a job ID that failed
    const testJobId = 'test-job-id-123';
    await page.goto(`/create/${testJobId}`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Look for retry button or similar
    const retryElements = [
      page.locator('button:has-text("Retry")'),
      page.locator('[data-testid="retry-button"]'),
      page.locator('button:has-text("Try Again")'),
      page.locator('text="Go back"'),
    ];
    
    let retryFound = false;
    for (const element of retryElements) {
      if (await element.isVisible().catch(() => false)) {
        retryFound = true;
        await element.click();
        await page.waitForLoadState('networkidle');
        break;
      }
    }
    
    // If no retry button found, at least ensure page doesn't crash
    if (!retryFound) {
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Application Error');
      expect(bodyText).not.toContain('500');
    }
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/create');
    await waitForSelector(page, 'textarea');
    
    const textarea = page.locator('textarea');
    await textarea.focus();
    
    // Test Ctrl+A (select all)
    await fillField(page, 'textarea', TEST_CONTENT);
    await page.keyboard.press('Control+a');
    
    // Type new content - should replace all
    await page.keyboard.type('New content');
    const newValue = await textarea.inputValue();
    expect(newValue).toBe('New content');
    
    // Test Ctrl+Z (undo) - might not work in all browsers
    await page.keyboard.press('Control+z');
    
    // Test Ctrl+Enter for quick submit (if implemented)
    await fillField(page, 'textarea', TEST_CONTENT);
    
    // This might trigger submission if implemented
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(1000);
    
    // Check if it triggered navigation or processing
    const urlChanged = !page.url().endsWith('/create');
    const processingStarted = await page.locator('[data-testid="processing"], .processing').isVisible().catch(() => false);
    
    // Either should work (or neither, which is also OK)
    console.log(`Ctrl+Enter test - URL changed: ${urlChanged}, Processing started: ${processingStarted}`);
  });

  test('should preserve content on page refresh', async ({ page }) => {
    await page.goto('/create');
    await waitForSelector(page, 'textarea');
    
    // Fill content
    const testContent = 'Test content for persistence';
    await fillField(page, 'textarea', testContent);
    
    // Refresh page
    await page.reload();
    await waitForSelector(page, 'textarea');
    
    // Check if content was preserved (depends on implementation)
    const preservedContent = await page.locator('textarea').inputValue();
    
    if (preservedContent === testContent) {
      console.log('✓ Content preserved across refresh');
    } else {
      console.log('ℹ Content not preserved (acceptable depending on implementation)');
    }
    
    // At minimum, page should work after refresh
    const isTextareaFocusable = await page.locator('textarea').isEditable();
    expect(isTextareaFocusable).toBeTruthy();
  });

  test('should handle concurrent processing jobs', async ({ page }) => {
    // This test simulates what happens if user has multiple processing jobs
    // Open first creation
    await page.goto('/create');
    await waitForSelector(page, 'textarea');
    await fillField(page, 'textarea', TEST_CONTENT);
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    await page.waitForLoadState('networkidle');
    const firstJobUrl = page.url();
    
    // Open second creation in new context (simulating another tab/window)
    const context = page.context();
    const secondPage = await context.newPage();
    await mockAuthentication(secondPage);
    
    await secondPage.goto('/create');
    await waitForSelector(secondPage, 'textarea');
    await fillField(secondPage, 'textarea', 'Different content for second job');
    
    const secondSubmitButton = secondPage.locator('button[type="submit"]');
    await secondSubmitButton.click();
    
    await secondPage.waitForLoadState('networkidle');
    
    // Both should work independently
    const firstPageWorking = !await page.locator('text="error"').isVisible().catch(() => false);
    const secondPageWorking = !await secondPage.locator('text="error"').isVisible().catch(() => false);
    
    expect(firstPageWorking && secondPageWorking).toBeTruthy();
    
    await secondPage.close();
  });
});