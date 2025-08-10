import { test, expect } from './setup';

test.describe('Terminal Functionality', () => {
  test('should display terminal component when terminal tab is active', async ({ window }) => {
    // Ensure terminal tab is active
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    
    // Wait for terminal to be visible
    await window.waitForTimeout(1000);
    
    // Check if terminal container exists
    const terminalContainer = await window.locator('div').filter({ hasText: /Terminal/i }).first();
    await expect(terminalContainer).toBeVisible();
  });

  test('should handle tab switching to context', async ({ window }) => {
    // Switch to context tab
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    
    // Wait for context view
    await window.waitForTimeout(500);
    
    // Verify context button is active
    await expect(contextButton).toHaveClass(/bg-blue-600/);
  });

  test('should handle tab switching to clipboard', async ({ window }) => {
    // Switch to clipboard tab
    const clipboardButton = await window.locator('button:has-text("💾 Clipboard")');
    await clipboardButton.click();
    
    // Wait for clipboard view
    await window.waitForTimeout(500);
    
    // Verify clipboard button is active
    await expect(clipboardButton).toHaveClass(/bg-blue-600/);
  });

  test('should handle tab switching to planner', async ({ window }) => {
    // Switch to planner tab
    const plannerButton = await window.locator('button:has-text("📋 Planner")');
    await plannerButton.click();
    
    // Wait for planner view
    await window.waitForTimeout(500);
    
    // Verify planner button is active
    await expect(plannerButton).toHaveClass(/bg-blue-600/);
  });

  test('should handle refresh button click', async ({ window }) => {
    // Click refresh button
    const refreshButton = await window.locator('button:has-text("🔄 Refresh")');
    await refreshButton.click();
    
    // Button should still be visible after click
    await expect(refreshButton).toBeVisible();
  });

  test('should display dark theme background', async ({ window }) => {
    // Check main container has dark background
    const mainContainer = await window.locator('.bg-gray-900');
    await expect(mainContainer).toBeVisible();
    
    // Check header has dark gray background
    const header = await window.locator('.bg-gray-800').first();
    await expect(header).toBeVisible();
  });
});