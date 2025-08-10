import { test, expect } from './setup';

test.describe('MythalTerminal App', () => {
  test('should launch and display main window', async ({ window }) => {
    // Check window title
    await expect(window).toHaveTitle('MythalTerminal');
    
    // Check that root element exists
    const root = await window.locator('#root');
    await expect(root).toBeVisible();
  });

  test('should display header with project path', async ({ window }) => {
    // Check header exists
    const header = await window.locator('.bg-gray-800').first();
    await expect(header).toBeVisible();
    
    // Check project path indicator
    const projectPath = await window.locator('text=/📁/');
    await expect(projectPath).toBeVisible();
  });

  test('should display refresh and settings buttons', async ({ window }) => {
    // Check refresh button
    const refreshButton = await window.locator('button:has-text("🔄 Refresh")');
    await expect(refreshButton).toBeVisible();
    
    // Check settings button  
    const settingsButton = await window.locator('button:has-text("⚙️ Settings")');
    await expect(settingsButton).toBeVisible();
  });

  test('should display terminal tab by default', async ({ window }) => {
    // Check terminal button is active (has blue background)
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await expect(terminalButton).toBeVisible();
    await expect(terminalButton).toHaveClass(/bg-blue-600/);
  });

  test('should switch between tabs', async ({ window }) => {
    // Click context tab
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    
    // Verify context tab is active
    await expect(contextButton).toHaveClass(/bg-blue-600/);
    
    // Click back to terminal tab
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    
    // Verify terminal tab is active again
    await expect(terminalButton).toHaveClass(/bg-blue-600/);
  });

  test('should display all navigation tabs', async ({ window }) => {
    // Check all tabs are present
    const tabs = [
      '💻 Terminal',
      '📊 Context', 
      '💾 Clipboard',
      '📋 Planner'
    ];
    
    for (const tabText of tabs) {
      const tab = await window.locator(`button:has-text("${tabText}")`);
      await expect(tab).toBeVisible();
    }
  });

  test('should display status bar', async ({ window }) => {
    // Status bar should be present (even if empty initially)
    const statusBar = await window.locator('.bg-gray-800').last();
    await expect(statusBar).toBeVisible();
  });
});