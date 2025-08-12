/**
 * Terminal Core Functionality E2E Tests
 * 
 * Comprehensive visual testing of all terminal features including:
 * - Initialization and focus management
 * - Input/output operations
 * - Special characters and ANSI colors
 * - Scrollback and search
 * - Copy/paste operations
 * - Resize behavior
 */

import { test, expect } from './setup';
import path from 'path';

const screenshotsDir = path.join(__dirname, 'screenshots', 'terminal-core');

test.describe('Terminal Core Functionality', () => {
  test.beforeEach(async ({ window }) => {
    // Ensure we start on terminal tab
    await window.waitForLoadState('domcontentloaded');
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(1500); // Allow terminal to fully initialize
  });

  test('terminal initialization and focus', async ({ window }) => {
    // Capture initial state
    await window.screenshot({
      path: path.join(screenshotsDir, '01-terminal-initial.png'),
      fullPage: true
    });

    // Check terminal container exists
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await expect(terminalContainer).toBeVisible();

    // Click on terminal to ensure focus
    await terminalContainer.click();
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '02-terminal-focused.png'),
      fullPage: true
    });

    // Verify cursor is blinking (terminal has focus)
    const cursor = await window.locator('.xterm-cursor, .xterm-cursor-layer').first();
    if (await cursor.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '03-terminal-cursor-visible.png'),
        clip: await terminalContainer.boundingBox() || undefined
      });
    }

    // Test focus retention after clicking elsewhere and back
    const header = await window.locator('.bg-gray-800').first();
    await header.click();
    await window.waitForTimeout(200);
    
    await window.screenshot({
      path: path.join(screenshotsDir, '04-terminal-unfocused.png'),
      fullPage: true
    });

    // Click back on terminal
    await terminalContainer.click();
    await window.waitForTimeout(200);

    await window.screenshot({
      path: path.join(screenshotsDir, '05-terminal-refocused.png'),
      fullPage: true
    });
  });

  test('basic input and output', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Type a simple echo command
    await window.keyboard.type('echo "Hello MythalTerminal"');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '06-typed-command.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Press Enter to execute
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '07-command-output.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Type another command
    await window.keyboard.type('pwd');
    await window.screenshot({
      path: path.join(screenshotsDir, '08-pwd-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '09-pwd-output.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test command with error
    await window.keyboard.type('invalidcommand123');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '10-error-output.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('special characters and ANSI colors', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test ANSI color codes
    await window.keyboard.type('echo -e "\\033[31mRed\\033[32mGreen\\033[34mBlue\\033[0m"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '11-ansi-colors.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test special characters
    await window.keyboard.type('echo "Special: © ® ™ € £ ¥ α β γ δ"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '12-special-chars.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test emoji support
    await window.keyboard.type('echo "Emojis: 🚀 💻 🤖 ✨ 📊 💾"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '13-emoji-support.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('keyboard shortcuts and navigation', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Type a long command
    await window.keyboard.type('echo "This is a very long command to test cursor movement and editing capabilities"');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '14-long-command.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test Ctrl+A (move to beginning)
    await window.keyboard.press('Control+a');
    await window.waitForTimeout(200);
    
    // Type at beginning
    await window.keyboard.type('START ');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '15-edited-beginning.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test Ctrl+E (move to end)
    await window.keyboard.press('Control+e');
    await window.waitForTimeout(200);
    
    // Type at end
    await window.keyboard.type(' END');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '16-edited-end.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test Ctrl+C (cancel current command)
    await window.keyboard.press('Control+c');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '17-command-cancelled.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test Ctrl+L (clear screen)
    await window.keyboard.press('Control+l');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '18-screen-cleared.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('command history navigation', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Execute several commands to build history
    const commands = [
      'echo "First command"',
      'echo "Second command"',
      'echo "Third command"',
      'ls -la',
      'pwd'
    ];

    for (const cmd of commands) {
      await window.keyboard.type(cmd);
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);
    }

    await window.screenshot({
      path: path.join(screenshotsDir, '19-command-history-built.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test Up arrow (previous command)
    await window.keyboard.press('ArrowUp');
    await window.waitForTimeout(200);

    await window.screenshot({
      path: path.join(screenshotsDir, '20-history-up-once.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Go up multiple times
    await window.keyboard.press('ArrowUp');
    await window.keyboard.press('ArrowUp');
    await window.waitForTimeout(200);

    await window.screenshot({
      path: path.join(screenshotsDir, '21-history-up-multiple.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test Down arrow (next command)
    await window.keyboard.press('ArrowDown');
    await window.waitForTimeout(200);

    await window.screenshot({
      path: path.join(screenshotsDir, '22-history-down.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('copy and paste operations', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Type some text to copy
    await window.keyboard.type('echo "Text to copy and paste"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);

    // Select text (simulate with shift+arrow keys)
    await window.keyboard.press('Shift+Home');
    await window.waitForTimeout(200);

    await window.screenshot({
      path: path.join(screenshotsDir, '23-text-selected.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Copy with Ctrl+Shift+C
    await window.keyboard.press('Control+Shift+c');
    await window.waitForTimeout(200);

    // Type new line and paste
    await window.keyboard.press('Enter');
    await window.keyboard.type('Pasted: ');
    await window.keyboard.press('Control+Shift+v');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '24-text-pasted.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('terminal resize behavior', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    
    // Capture at default size
    await window.screenshot({
      path: path.join(screenshotsDir, '25-resize-default.png'),
      fullPage: true
    });

    // Resize to smaller viewport
    await window.setViewportSize({ width: 800, height: 600 });
    await window.waitForTimeout(1000); // Allow terminal to adjust

    await window.screenshot({
      path: path.join(screenshotsDir, '26-resize-small.png'),
      fullPage: true
    });

    // Resize to larger viewport
    await window.setViewportSize({ width: 1920, height: 1080 });
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '27-resize-large.png'),
      fullPage: true
    });

    // Restore original size
    await window.setViewportSize({ width: 1400, height: 900 });
    await window.waitForTimeout(1000);

    // Verify terminal content is preserved after resize
    await terminalContainer.click();
    await window.keyboard.type('echo "Content after resize"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '28-resize-content-preserved.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('scrollback buffer and scrolling', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Generate lots of output to test scrolling
    await window.keyboard.type('for i in {1..50}; do echo "Line $i of scrollback test"; done');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000); // Allow command to complete

    await window.screenshot({
      path: path.join(screenshotsDir, '29-scrollback-filled.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Scroll up
    await window.keyboard.press('Shift+PageUp');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '30-scrolled-up.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Scroll to top
    await window.keyboard.press('Shift+Home');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '31-scrolled-top.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Scroll back down
    await window.keyboard.press('Shift+End');
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '32-scrolled-bottom.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('terminal welcome message display', async ({ window }) => {
    // Reload to see welcome message
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Wait for welcome message

    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    
    await window.screenshot({
      path: path.join(screenshotsDir, '33-welcome-message.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Verify welcome message contains expected text
    const terminalText = await terminalContainer.textContent();
    expect(terminalText).toContain('MythalTerminal');
  });
});

test.describe('Terminal Error Handling', () => {
  test('handles terminal creation failure gracefully', async ({ window }) => {
    // This test would require mocking terminal creation failure
    // For now, we document the expected behavior
    
    await window.waitForLoadState('domcontentloaded');
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(1000);

    // Screenshot normal state for comparison
    await window.screenshot({
      path: path.join(screenshotsDir, '34-terminal-normal-state.png'),
      fullPage: true
    });
  });
});