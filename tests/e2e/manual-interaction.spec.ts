/**
 * Manual Interaction Test - Step by Step Testing
 * 
 * This test suite manually tests each component of MythalTerminal
 * to verify input functionality and identify issues
 */

import { test, expect } from './setup';
import path from 'path';

const screenshotsDir = path.join(__dirname, 'screenshots', 'manual-interaction');

test.describe('Manual Step-by-Step Interaction Tests', () => {
  test('complete UI interaction test', async ({ window }) => {
    // Wait for app to fully load
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000);

    // 1. TEST TERMINAL TAB
    console.log('Testing Terminal Tab...');
    
    // Ensure terminal tab is active (should be by default)
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '01-terminal-tab-active.png'),
      fullPage: true
    });

    // Try to find and click on the terminal area
    const terminalArea = await window.locator('.xterm-screen, .xterm, [class*="terminal"], #terminal, div:has(canvas)').first();
    
    if (await terminalArea.isVisible()) {
      console.log('Terminal area found, attempting to interact...');
      
      // Click to focus
      await terminalArea.click();
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '02-terminal-clicked.png'),
        fullPage: true
      });

      // Try typing a command
      await window.keyboard.type('echo "Testing terminal input"');
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '03-terminal-typed-command.png'),
        fullPage: true
      });

      // Press Enter
      await window.keyboard.press('Enter');
      await window.waitForTimeout(1000);

      await window.screenshot({
        path: path.join(screenshotsDir, '04-terminal-command-executed.png'),
        fullPage: true
      });

      // Try a Claude command
      await window.keyboard.type('/help');
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '05-terminal-help-command.png'),
        fullPage: true
      });

      await window.keyboard.press('Enter');
      await window.waitForTimeout(1500);

      await window.screenshot({
        path: path.join(screenshotsDir, '06-terminal-help-output.png'),
        fullPage: true
      });
    } else {
      console.log('Terminal area not found!');
      await window.screenshot({
        path: path.join(screenshotsDir, 'ERROR-no-terminal.png'),
        fullPage: true
      });
    }

    // 2. TEST CONTEXT TAB
    console.log('Testing Context Tab...');
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1500);

    await window.screenshot({
      path: path.join(screenshotsDir, '07-context-tab-active.png'),
      fullPage: true
    });

    // Find and test the search input
    const searchInput = await window.locator('input[placeholder*="Search context layers semantically"]').first();
    
    if (await searchInput.isVisible()) {
      console.log('Search input found, testing interaction...');
      
      await searchInput.click();
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '08-context-search-focused.png'),
        fullPage: true
      });

      await searchInput.type('test search query');
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '09-context-search-typed.png'),
        fullPage: true
      });

      // Try to press Enter or click search button
      await window.keyboard.press('Enter');
      await window.waitForTimeout(1000);

      await window.screenshot({
        path: path.join(screenshotsDir, '10-context-search-executed.png'),
        fullPage: true
      });
    } else {
      console.log('Context search input not found!');
      await window.screenshot({
        path: path.join(screenshotsDir, 'ERROR-no-search-input.png'),
        fullPage: true
      });
    }

    // 3. TEST CLIPBOARD TAB
    console.log('Testing Clipboard Tab...');
    const clipboardButton = await window.locator('button:has-text("💾 Clipboard")');
    await clipboardButton.click();
    await window.waitForTimeout(1500);

    await window.screenshot({
      path: path.join(screenshotsDir, '11-clipboard-tab-active.png'),
      fullPage: true
    });

    // Find the clipboard textarea
    const clipboardTextarea = await window.locator('textarea[placeholder*="Paste or type content"]').first();
    
    if (await clipboardTextarea.isVisible()) {
      console.log('Clipboard textarea found, testing interaction...');
      
      await clipboardTextarea.click();
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '12-clipboard-textarea-focused.png'),
        fullPage: true
      });

      await clipboardTextarea.type('Test clipboard content\nLine 2\nLine 3');
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '13-clipboard-content-typed.png'),
        fullPage: true
      });

      // Find and type in tags input
      const tagsInput = await window.locator('input[placeholder*="Tags"]').first();
      if (await tagsInput.isVisible()) {
        await tagsInput.click();
        await tagsInput.type('test, clipboard, demo');
        await window.waitForTimeout(500);

        await window.screenshot({
          path: path.join(screenshotsDir, '14-clipboard-tags-added.png'),
          fullPage: true
        });
      }

      // Try to save
      const saveButton = await window.locator('button:has-text("💾 Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await window.waitForTimeout(1000);

        await window.screenshot({
          path: path.join(screenshotsDir, '15-clipboard-after-save.png'),
          fullPage: true
        });
      }
    } else {
      console.log('Clipboard textarea not found!');
      await window.screenshot({
        path: path.join(screenshotsDir, 'ERROR-no-clipboard-textarea.png'),
        fullPage: true
      });
    }

    // 4. TEST PLANNER TAB
    console.log('Testing Planner Tab...');
    const plannerButton = await window.locator('button:has-text("📋 Planner")');
    await plannerButton.click();
    await window.waitForTimeout(1500);

    await window.screenshot({
      path: path.join(screenshotsDir, '16-planner-tab-active.png'),
      fullPage: true
    });

    // Find and click New Task button
    const newTaskButton = await window.locator('button:has-text("➕ New Task")').first();
    
    if (await newTaskButton.isVisible()) {
      console.log('New Task button found, clicking...');
      await newTaskButton.click();
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '17-planner-new-task-form.png'),
        fullPage: true
      });

      // Find and fill task title
      const taskTitleInput = await window.locator('input[placeholder*="Task title"]').first();
      if (await taskTitleInput.isVisible()) {
        await taskTitleInput.click();
        await taskTitleInput.type('Test Task from Playwright');
        await window.waitForTimeout(500);

        await window.screenshot({
          path: path.join(screenshotsDir, '18-planner-task-title-typed.png'),
          fullPage: true
        });

        // Fill description
        const taskDescTextarea = await window.locator('textarea[placeholder*="Task description"]').first();
        if (await taskDescTextarea.isVisible()) {
          await taskDescTextarea.click();
          await taskDescTextarea.type('This is a test task created through automated testing');
          await window.waitForTimeout(500);

          await window.screenshot({
            path: path.join(screenshotsDir, '19-planner-task-description-typed.png'),
            fullPage: true
          });
        }

        // Add the task
        const addTaskButton = await window.locator('button:has-text("✅ Add Task")').first();
        if (await addTaskButton.isVisible()) {
          await addTaskButton.click();
          await window.waitForTimeout(1000);

          await window.screenshot({
            path: path.join(screenshotsDir, '20-planner-task-added.png'),
            fullPage: true
          });
        }
      }
    } else {
      console.log('New Task button not found!');
      await window.screenshot({
        path: path.join(screenshotsDir, 'ERROR-no-new-task-button.png'),
        fullPage: true
      });
    }

    // 5. TEST SETTINGS
    console.log('Testing Settings...');
    const settingsButton = await window.locator('button:has-text("⚙️ Settings")');
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await window.waitForTimeout(1000);

      await window.screenshot({
        path: path.join(screenshotsDir, '21-settings-modal-open.png'),
        fullPage: true
      });

      // Try to find API key input
      const apiKeyInput = await window.locator('input[type="password"], input[placeholder*="API"], input[placeholder*="key"]').first();
      if (await apiKeyInput.isVisible()) {
        await apiKeyInput.click();
        await apiKeyInput.type('test-api-key-12345');
        await window.waitForTimeout(500);

        await window.screenshot({
          path: path.join(screenshotsDir, '22-settings-api-key-typed.png'),
          fullPage: true
        });
      }

      // Close settings
      const closeButton = await window.locator('button:has-text("Close"), button:has-text("Cancel"), button:has-text("✕")').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await window.waitForTimeout(500);
      } else {
        // Try pressing Escape
        await window.keyboard.press('Escape');
        await window.waitForTimeout(500);
      }

      await window.screenshot({
        path: path.join(screenshotsDir, '23-settings-closed.png'),
        fullPage: true
      });
    }

    // 6. FINAL OVERVIEW
    console.log('Capturing final state...');
    
    // Go back to terminal tab
    await terminalButton.click();
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '24-final-terminal-state.png'),
      fullPage: true
    });

    // Log what text is visible
    const visibleText = await window.textContent('body');
    console.log('Visible text on page:', visibleText);

    // Get all input elements
    const inputs = await window.locator('input, textarea, [contenteditable="true"]').all();
    console.log(`Found ${inputs.length} input elements`);
    
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const isVisible = await input.isVisible();
      const isEnabled = await input.isEnabled();
      const placeholder = await input.getAttribute('placeholder');
      const type = await input.getAttribute('type');
      console.log(`Input ${i}: visible=${isVisible}, enabled=${isEnabled}, type=${type}, placeholder=${placeholder}`);
    }

    // Final summary screenshot
    await window.screenshot({
      path: path.join(screenshotsDir, '25-test-complete.png'),
      fullPage: true
    });
  });
});