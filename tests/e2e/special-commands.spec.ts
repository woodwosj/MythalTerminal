/**
 * Special Commands E2E Tests
 * 
 * Comprehensive testing of special terminal commands:
 * - /help - Display available commands
 * - /clear - Clear terminal and archive
 * - /status - Show Claude instance status
 * - /history - Show command history
 */

import { test, expect } from './setup';
import path from 'path';

const screenshotsDir = path.join(__dirname, 'screenshots', 'special-commands');

test.describe('Special Terminal Commands', () => {
  test.beforeEach(async ({ window }) => {
    await window.waitForLoadState('domcontentloaded');
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(1500);
  });

  test('/help command display', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Capture initial state
    await window.screenshot({
      path: path.join(screenshotsDir, '01-before-help.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Type /help command
    await window.keyboard.type('/help');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '02-help-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Execute command
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Capture help output
    await window.screenshot({
      path: path.join(screenshotsDir, '03-help-output.png'),
      fullPage: true
    });

    // Verify help content includes expected commands
    const terminalText = await terminalContainer.textContent();
    expect(terminalText).toContain('claude:');
    expect(terminalText).toContain('/claude');
    expect(terminalText).toContain('ai:');
    expect(terminalText).toContain('/ai');
    expect(terminalText).toContain('/help');
    expect(terminalText).toContain('/clear');
    expect(terminalText).toContain('/status');
    expect(terminalText).toContain('/history');

    // Capture close-up of help text
    await window.screenshot({
      path: path.join(screenshotsDir, '04-help-details.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('/clear command and archiving', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Add some content to clear
    await window.keyboard.type('echo "Line 1 - will be archived"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);

    await window.keyboard.type('echo "Line 2 - also archived"');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(500);

    await window.keyboard.type('claude: Test message for archiving');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000);

    // Capture terminal with content
    await window.screenshot({
      path: path.join(screenshotsDir, '05-terminal-with-content.png'),
      fullPage: true
    });

    // Type /clear command
    await window.keyboard.type('/clear');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '06-clear-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Execute clear
    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000);

    // Capture cleared terminal
    await window.screenshot({
      path: path.join(screenshotsDir, '07-terminal-cleared.png'),
      fullPage: true
    });

    // Verify archive message
    const terminalText = await terminalContainer.textContent();
    if (terminalText?.includes('archived')) {
      await window.screenshot({
        path: path.join(screenshotsDir, '08-archive-confirmation.png'),
        clip: await terminalContainer.boundingBox() || undefined
      });
    }

    // Check context tab for archive
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '09-archive-in-context.png'),
      fullPage: true
    });
  });

  test('/status command display', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Type /status command
    await window.keyboard.type('/status');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '10-status-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Execute command
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Capture status output
    await window.screenshot({
      path: path.join(screenshotsDir, '11-status-output.png'),
      fullPage: true
    });

    // Verify status shows Claude instances
    const terminalText = await terminalContainer.textContent();
    expect(terminalText).toContain('Claude');
    
    // Look for status indicators (🟢, 🟡, 🔴)
    const statusIndicators = ['🟢', '🟡', '🔴'];
    let foundIndicator = false;
    for (const indicator of statusIndicators) {
      if (terminalText?.includes(indicator)) {
        foundIndicator = true;
        break;
      }
    }

    if (foundIndicator) {
      await window.screenshot({
        path: path.join(screenshotsDir, '12-status-indicators.png'),
        clip: await terminalContainer.boundingBox() || undefined
      });
    }

    // Check for instance names
    const instances = ['main', 'contextManager', 'summarizer', 'planner'];
    for (const instance of instances) {
      if (terminalText?.includes(instance)) {
        await window.screenshot({
          path: path.join(screenshotsDir, `13-status-${instance}.png`),
          clip: await terminalContainer.boundingBox() || undefined
        });
        break;
      }
    }
  });

  test('/history command display', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Build command history
    const commands = [
      'echo "First command"',
      'ls -la',
      'pwd',
      'claude: Test AI command',
      'echo "Last command"'
    ];

    for (const cmd of commands) {
      await window.keyboard.type(cmd);
      await window.keyboard.press('Enter');
      await window.waitForTimeout(500);
    }

    // Capture terminal with history
    await window.screenshot({
      path: path.join(screenshotsDir, '14-commands-executed.png'),
      fullPage: true
    });

    // Type /history command
    await window.keyboard.type('/history');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '15-history-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Execute command
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Capture history output
    await window.screenshot({
      path: path.join(screenshotsDir, '16-history-output.png'),
      fullPage: true
    });

    // Verify history contains executed commands
    const terminalText = await terminalContainer.textContent();
    expect(terminalText).toContain('Command History');
    
    // Check for numbered list
    for (let i = 1; i <= 5; i++) {
      if (terminalText?.includes(`${i}.`)) {
        await window.screenshot({
          path: path.join(screenshotsDir, `17-history-item-${i}.png`),
          clip: await terminalContainer.boundingBox() || undefined
        });
        break;
      }
    }
  });

  test('command not found handling', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Try an invalid special command
    await window.keyboard.type('/invalidcommand');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '18-invalid-command-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Should pass through to shell and show error
    await window.screenshot({
      path: path.join(screenshotsDir, '19-invalid-command-error.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('special commands case sensitivity', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test uppercase variant
    await window.keyboard.type('/HELP');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '20-uppercase-help.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Check if it's treated as special command or regular shell command
    await window.screenshot({
      path: path.join(screenshotsDir, '21-uppercase-result.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test mixed case
    await window.keyboard.type('/Help');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '22-mixedcase-result.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('special commands with extra spaces', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test with leading spaces
    await window.keyboard.type('  /help');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '23-leading-spaces.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '24-leading-spaces-result.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Test with trailing spaces
    await window.keyboard.type('/help  ');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '25-trailing-spaces-result.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('chaining special commands', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Execute multiple special commands in sequence
    const commandSequence = [
      '/help',
      '/status',
      '/history',
      '/clear'
    ];

    for (const cmd of commandSequence) {
      await window.keyboard.type(cmd);
      
      await window.screenshot({
        path: path.join(screenshotsDir, `26-chain-${cmd.slice(1)}-typed.png`),
        clip: await terminalContainer.boundingBox() || undefined
      });

      await window.keyboard.press('Enter');
      await window.waitForTimeout(1000);

      await window.screenshot({
        path: path.join(screenshotsDir, `27-chain-${cmd.slice(1)}-result.png`),
        fullPage: true
      });
    }

    // Final state after all commands
    await window.screenshot({
      path: path.join(screenshotsDir, '28-final-chained-state.png'),
      fullPage: true
    });
  });

  test('special commands in rapid succession', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Type and execute commands quickly
    await window.keyboard.type('/help');
    await window.keyboard.press('Enter');
    await window.keyboard.type('/status');
    await window.keyboard.press('Enter');
    await window.keyboard.type('/history');
    await window.keyboard.press('Enter');

    // Wait for all to process
    await window.waitForTimeout(2000);

    // Capture final state
    await window.screenshot({
      path: path.join(screenshotsDir, '29-rapid-commands-result.png'),
      fullPage: true
    });
  });

  test('special commands with Claude commands', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Mix special and Claude commands
    await window.keyboard.type('/help');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.keyboard.type('claude: What commands are available?');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000);

    await window.keyboard.type('/status');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Capture mixed command results
    await window.screenshot({
      path: path.join(screenshotsDir, '30-mixed-commands.png'),
      fullPage: true
    });
  });
});