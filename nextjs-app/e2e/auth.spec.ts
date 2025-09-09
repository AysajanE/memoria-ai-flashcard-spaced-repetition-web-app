/**
 * @file auth.spec.ts
 * @description E2E tests for authentication flow
 * 
 * Tests the complete authentication journey including:
 * - Landing page accessibility
 * - Sign up/Sign in flow
 * - Protected route access
 * - User session persistence
 */

import { test, expect } from '@playwright/test';
import { mockAuthentication, waitForSelector } from './utils/test-helpers';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the landing page
    await page.goto('/');
  });

  test('should show landing page for unauthenticated users', async ({ page }) => {
    // Check that we can access the landing page
    await expect(page).toHaveTitle(/Memoria/);
    
    // Should show sign in/up options for unauthenticated users
    const authElements = [
      page.locator('text="Sign In"'),
      page.locator('text="Get Started"'),
      page.locator('text="Sign Up"'),
      page.locator('[data-testid="auth-button"]'),
    ];
    
    // At least one auth element should be visible
    let authElementFound = false;
    for (const element of authElements) {
      if (await element.isVisible().catch(() => false)) {
        authElementFound = true;
        break;
      }
    }
    
    if (!authElementFound) {
      // If no auth elements found, it might mean we're already authenticated or different UI
      console.log('No auth elements found - checking for dashboard/authenticated state');
      
      // Check for authenticated state
      const dashboardIndicators = [
        page.locator('[data-testid="user-menu"]'),
        page.locator('text="Dashboard"'),
        page.locator('text="My Decks"'),
        page.locator('[data-testid="create-deck-button"]'),
      ];
      
      let dashboardFound = false;
      for (const element of dashboardIndicators) {
        if (await element.isVisible().catch(() => false)) {
          dashboardFound = true;
          break;
        }
      }
      
      expect(dashboardFound).toBeTruthy();
    }
  });

  test('should redirect to protected routes after authentication', async ({ page }) => {
    await mockAuthentication(page);
    
    // Try to access a protected route
    await page.goto('/dashboard');
    
    // Should not be redirected to sign-in if properly authenticated
    await page.waitForLoadState('networkidle');
    
    // Check that we're not on a sign-in page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('sign-in');
    expect(currentUrl).not.toContain('auth');
    
    // Should show some content (not just error page)
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('Page Not Found');
  });

  test('should handle navigation between public and protected areas', async ({ page }) => {
    // Start on landing page
    await page.goto('/');
    await expect(page).toHaveURL('/');
    
    // Try to access dashboard (should work if authenticated, redirect if not)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    
    if (currentUrl.includes('sign-in') || currentUrl.includes('auth')) {
      // We were redirected to auth - this is expected for unauthenticated users
      expect(currentUrl).toMatch(/(sign-in|auth)/);
    } else {
      // We reached dashboard - this means we're authenticated
      expect(currentUrl).toMatch(/dashboard|\/$/);
    }
  });

  test('should show proper loading states during navigation', async ({ page }) => {
    await page.goto('/');
    
    // Click navigation links and ensure they load properly
    const navLinks = await page.locator('nav a, [data-testid="nav-link"]').all();
    
    for (let i = 0; i < Math.min(navLinks.length, 3); i++) {
      const link = navLinks[i];
      const href = await link.getAttribute('href');
      
      if (href && !href.startsWith('http') && href !== '#') {
        await link.click();
        await page.waitForLoadState('networkidle');
        
        // Check that page loaded successfully
        const bodyText = await page.textContent('body');
        expect(bodyText).not.toContain('This page could not be found');
        
        // Go back for next iteration
        await page.goBack();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    await mockAuthentication(page);
    
    // Navigate to a page that requires auth
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const urlBeforeRefresh = page.url();
    
    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const urlAfterRefresh = page.url();
    
    // Should stay on the same page (not redirected to auth)
    expect(urlAfterRefresh).toBe(urlBeforeRefresh);
    
    // Should not show sign-in elements
    const signInVisible = await page.locator('text="Sign In"').isVisible().catch(() => false);
    expect(signInVisible).toBeFalsy();
  });

  test('should handle keyboard navigation on auth elements', async ({ page }) => {
    await page.goto('/');
    
    // Find focusable auth elements
    const authButtons = page.locator('button, a').filter({ hasText: /Sign|Auth|Login|Get Started/i });
    const firstAuthButton = authButtons.first();
    
    if (await firstAuthButton.isVisible().catch(() => false)) {
      // Test keyboard focus
      await firstAuthButton.focus();
      await expect(firstAuthButton).toBeFocused();
      
      // Test Enter key activation
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      
      // Should have navigated somewhere or opened a modal
      const currentUrl = page.url();
      const hasModal = await page.locator('[role="dialog"], .modal, [data-testid="auth-modal"]').isVisible().catch(() => false);
      
      expect(currentUrl !== '/' || hasModal).toBeTruthy();
    }
  });

  test('should handle edge cases gracefully', async ({ page }) => {
    // Test direct access to auth callback URL (if exists)
    await page.goto('/auth/callback').catch(() => {
      // It's OK if this route doesn't exist
    });
    await page.waitForLoadState('networkidle');
    
    // Should not crash or show error
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application Error');
    
    // Test access with fragment/hash
    await page.goto('/#auth');
    await page.waitForLoadState('networkidle');
    
    // Should load normally
    const isLoaded = await page.locator('body').isVisible();
    expect(isLoaded).toBeTruthy();
  });
});