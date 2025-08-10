import { test, expect } from './setup';

test.describe('Context Management', () => {
  test('should switch to context view', async ({ window }) => {
    // Click context tab
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    
    // Wait for context view to load
    await window.waitForTimeout(1000);
    
    // Verify context tab is active
    await expect(contextButton).toHaveClass(/bg-blue-600/);
  });

  test('should display context manager when context tab is active', async ({ window }) => {
    // Switch to context tab
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    
    // Wait for context manager to potentially render
    await window.waitForTimeout(1000);
    
    // Context manager should be in the viewport
    const contextArea = await window.locator('.flex-1.overflow-hidden');
    await expect(contextArea).toBeVisible();
  });

  test('should maintain tab state when switching', async ({ window }) => {
    // Start with terminal tab
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await expect(terminalButton).toHaveClass(/bg-blue-600/);
    
    // Switch to context
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await expect(contextButton).toHaveClass(/bg-blue-600/);
    await expect(terminalButton).not.toHaveClass(/bg-blue-600/);
    
    // Switch to clipboard
    const clipboardButton = await window.locator('button:has-text("💾 Clipboard")');
    await clipboardButton.click();
    await expect(clipboardButton).toHaveClass(/bg-blue-600/);
    await expect(contextButton).not.toHaveClass(/bg-blue-600/);
    
    // Switch to planner
    const plannerButton = await window.locator('button:has-text("📋 Planner")');
    await plannerButton.click();
    await expect(plannerButton).toHaveClass(/bg-blue-600/);
    await expect(clipboardButton).not.toHaveClass(/bg-blue-600/);
    
    // Back to terminal
    await terminalButton.click();
    await expect(terminalButton).toHaveClass(/bg-blue-600/);
    await expect(plannerButton).not.toHaveClass(/bg-blue-600/);
  });

  test('should have consistent layout across tabs', async ({ window }) => {
    // Check header stays visible
    const header = await window.locator('.bg-gray-800').first();
    
    // Check all tabs and verify header remains
    const tabs = ['💻 Terminal', '📊 Context', '💾 Clipboard', '📋 Planner'];
    
    for (const tabText of tabs) {
      const tab = await window.locator(`button:has-text("${tabText}")`);
      await tab.click();
      await window.waitForTimeout(200);
      await expect(header).toBeVisible();
    }
  });
});