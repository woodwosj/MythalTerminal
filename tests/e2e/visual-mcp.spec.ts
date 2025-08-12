/**
 * Visual E2E Testing using Playwright MCP
 * 
 * This test suite demonstrates how to use the Playwright MCP server
 * for visual testing of the MythalTerminal application.
 * 
 * The MCP server provides browser automation capabilities that can be
 * invoked through Claude or other MCP clients.
 */

import { test, expect } from './setup';
import path from 'path';

test.describe('Visual E2E Tests with Screenshots', () => {
  test('capture full application state', async ({ window }) => {
    // Wait for app to fully load
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000); // Allow animations to complete

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, 'screenshots');
    
    // Capture initial state
    await window.screenshot({
      path: path.join(screenshotsDir, 'app-initial-state.png'),
      fullPage: true
    });

    // Test Terminal tab
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(500);
    
    await window.screenshot({
      path: path.join(screenshotsDir, 'terminal-tab-active.png'),
      fullPage: true
    });

    // Test Context tab
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(500);
    
    await window.screenshot({
      path: path.join(screenshotsDir, 'context-tab-active.png'),
      fullPage: true
    });

    // Test Clipboard tab
    const clipboardButton = await window.locator('button:has-text("💾 Clipboard")');
    await clipboardButton.click();
    await window.waitForTimeout(500);
    
    await window.screenshot({
      path: path.join(screenshotsDir, 'clipboard-tab-active.png'),
      fullPage: true
    });

    // Test Planner tab
    const plannerButton = await window.locator('button:has-text("📋 Planner")');
    await plannerButton.click();
    await window.waitForTimeout(500);
    
    await window.screenshot({
      path: path.join(screenshotsDir, 'planner-tab-active.png'),
      fullPage: true
    });
  });

  test('visual regression testing', async ({ window }) => {
    // This test uses Playwright's built-in screenshot comparison
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    // Take a screenshot and compare with baseline
    await expect(window).toHaveScreenshot('main-window.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled'
    });

    // Test each tab with visual regression
    const tabs = [
      { name: 'Terminal', text: '💻 Terminal' },
      { name: 'Context', text: '📊 Context' },
      { name: 'Clipboard', text: '💾 Clipboard' },
      { name: 'Planner', text: '📋 Planner' }
    ];

    for (const tab of tabs) {
      const button = await window.locator(`button:has-text("${tab.text}")`);
      await button.click();
      await window.waitForTimeout(500);
      
      await expect(window).toHaveScreenshot(`${tab.name.toLowerCase()}-tab.png`, {
        maxDiffPixels: 100,
        threshold: 0.2,
        animations: 'disabled'
      });
    }
  });

  test('capture element screenshots', async ({ window }) => {
    await window.waitForLoadState('domcontentloaded');
    
    // Capture header
    const header = await window.locator('.bg-gray-800').first();
    if (await header.isVisible()) {
      await header.screenshot({
        path: path.join(__dirname, 'screenshots', 'header.png')
      });
    }

    // Capture navigation tabs
    const navTabs = await window.locator('.flex.space-x-2').first();
    if (await navTabs.isVisible()) {
      await navTabs.screenshot({
        path: path.join(__dirname, 'screenshots', 'navigation-tabs.png')
      });
    }

    // Capture main content area
    const mainContent = await window.locator('#root > div > div:nth-child(2)');
    if (await mainContent.isVisible()) {
      await mainContent.screenshot({
        path: path.join(__dirname, 'screenshots', 'main-content.png')
      });
    }
  });

  test('test terminal interaction visually', async ({ window }) => {
    await window.waitForLoadState('domcontentloaded');
    
    // Ensure terminal tab is active
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(500);

    // Take baseline screenshot
    await window.screenshot({
      path: path.join(__dirname, 'screenshots', 'terminal-before-input.png')
    });

    // Try to interact with terminal if it exists
    const terminalInput = await window.locator('.terminal-input, input[type="text"], textarea').first();
    if (await terminalInput.isVisible()) {
      await terminalInput.click();
      await terminalInput.type('echo "Visual testing with Playwright MCP"');
      
      await window.screenshot({
        path: path.join(__dirname, 'screenshots', 'terminal-with-input.png')
      });
      
      await window.keyboard.press('Enter');
      await window.waitForTimeout(1000);
      
      await window.screenshot({
        path: path.join(__dirname, 'screenshots', 'terminal-after-command.png')
      });
    }
  });

  test('test responsive behavior', async ({ window }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-1080p' },
      { width: 1400, height: 900, name: 'desktop-standard' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 768, height: 1024, name: 'tablet-portrait' }
    ];

    for (const viewport of viewports) {
      await window.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      
      await window.waitForTimeout(500); // Allow layout to adjust
      
      await window.screenshot({
        path: path.join(__dirname, 'screenshots', `responsive-${viewport.name}.png`),
        fullPage: true
      });
    }
  });

  test('test dark mode appearance', async ({ window }) => {
    // Capture current theme
    await window.screenshot({
      path: path.join(__dirname, 'screenshots', 'theme-default.png'),
      fullPage: true
    });

    // Try to toggle theme if settings exist
    const settingsButton = await window.locator('button:has-text("⚙️ Settings")');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await window.waitForTimeout(500);
      
      await window.screenshot({
        path: path.join(__dirname, 'screenshots', 'settings-modal.png')
      });
      
      // Look for theme toggle
      const themeToggle = await window.locator('button:has-text("Theme"), input[type="checkbox"]').first();
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await window.waitForTimeout(500);
        
        await window.screenshot({
          path: path.join(__dirname, 'screenshots', 'theme-toggled.png'),
          fullPage: true
        });
      }
    }
  });
});

test.describe('Performance Visual Tests', () => {
  test('measure rendering performance', async ({ window }) => {
    // Capture screenshots at different stages of loading
    const loadStages = [];
    
    // Initial load
    const start = Date.now();
    await window.goto('about:blank'); // Reset
    await window.reload();
    
    // Capture at intervals
    for (let i = 0; i < 5; i++) {
      await window.waitForTimeout(200);
      const elapsed = Date.now() - start;
      
      await window.screenshot({
        path: path.join(__dirname, 'screenshots', `load-stage-${i}-${elapsed}ms.png`)
      });
      
      loadStages.push({
        stage: i,
        elapsed: elapsed,
        screenshot: `load-stage-${i}-${elapsed}ms.png`
      });
    }
    
    // Log performance metrics
    console.log('Load stages captured:', loadStages);
  });
});