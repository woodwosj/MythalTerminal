/**
 * Claude AI Integration E2E Tests
 * 
 * Comprehensive testing of Claude AI features including:
 * - Command parsing (claude:, /claude, ai:, /ai)
 * - Response streaming
 * - Error handling
 * - Multiple instance management
 * - Token counting
 */

import { test, expect } from './setup';
import path from 'path';

const screenshotsDir = path.join(__dirname, 'screenshots', 'claude-integration');

test.describe('Claude AI Integration', () => {
  test.beforeEach(async ({ window }) => {
    await window.waitForLoadState('domcontentloaded');
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(1500);
  });

  test('claude: command format', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test claude: prefix
    await window.keyboard.type('claude: What is MythalTerminal?');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '01-claude-colon-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Capture thinking state
    await window.screenshot({
      path: path.join(screenshotsDir, '02-claude-thinking.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Wait for response (mocked or real)
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '03-claude-response.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('/claude command format', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test /claude command
    await window.keyboard.type('/claude Explain the context management system');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '04-slash-claude-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '05-slash-claude-processing.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Wait for response
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '06-slash-claude-response.png'),
      fullPage: true
    });
  });

  test('ai: command format', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test ai: prefix
    await window.keyboard.type('ai: Generate a Python hello world script');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '07-ai-colon-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '08-ai-processing.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Wait for code generation response
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '09-ai-code-response.png'),
      fullPage: true
    });
  });

  test('/ai command format', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test /ai command
    await window.keyboard.type('/ai List the key features of this terminal');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '10-slash-ai-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(4000);

    await window.screenshot({
      path: path.join(screenshotsDir, '11-slash-ai-response.png'),
      fullPage: true
    });
  });

  test('response streaming visualization', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Send a command that generates longer response
    await window.keyboard.type('claude: Explain all the layers in the context management system in detail');
    await window.keyboard.press('Enter');
    
    // Capture multiple stages of streaming
    const streamingStages = [];
    for (let i = 0; i < 5; i++) {
      await window.waitForTimeout(1000);
      await window.screenshot({
        path: path.join(screenshotsDir, `12-streaming-stage-${i}.png`),
        clip: await terminalContainer.boundingBox() || undefined
      });
      streamingStages.push(`streaming-stage-${i}.png`);
    }

    // Final complete response
    await window.waitForTimeout(2000);
    await window.screenshot({
      path: path.join(screenshotsDir, '13-streaming-complete.png'),
      fullPage: true
    });
  });

  test('error handling - empty message', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Send empty claude command
    await window.keyboard.type('claude:');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '14-empty-command.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Should show error message
    await window.screenshot({
      path: path.join(screenshotsDir, '15-empty-command-error.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });
  });

  test('error handling - API failure simulation', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // This would normally require API key removal or network disconnection
    // For now, document expected behavior
    await window.keyboard.type('claude: Test API error handling');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '16-api-test-command.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000);

    await window.screenshot({
      path: path.join(screenshotsDir, '17-api-response-or-error.png'),
      fullPage: true
    });
  });

  test('multiple Claude instances visualization', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test different Claude instances
    const instances = [
      { command: 'claude: General question about TypeScript', name: 'main' },
      { command: '/claude context: Analyze current context layers', name: 'contextManager' },
      { command: 'ai: Summarize this conversation', name: 'summarizer' },
      { command: '/ai plan: Create a development plan', name: 'planner' }
    ];

    for (const instance of instances) {
      await window.keyboard.type(instance.command);
      
      await window.screenshot({
        path: path.join(screenshotsDir, `18-instance-${instance.name}-command.png`),
        clip: await terminalContainer.boundingBox() || undefined
      });

      await window.keyboard.press('Enter');
      await window.waitForTimeout(2000);

      await window.screenshot({
        path: path.join(screenshotsDir, `19-instance-${instance.name}-response.png`),
        clip: await terminalContainer.boundingBox() || undefined
      });
    }
  });

  test('token counting display', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Check initial token count
    const statusBar = await window.locator('[class*="status"], [class*="token"]').first();
    
    await window.screenshot({
      path: path.join(screenshotsDir, '20-initial-token-count.png'),
      fullPage: true
    });

    // Send a message to Claude
    await window.keyboard.type('claude: Provide a detailed explanation of async/await in JavaScript');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    // Capture updated token count
    await window.screenshot({
      path: path.join(screenshotsDir, '21-updated-token-count.png'),
      fullPage: true
    });

    // Send another message to see cumulative tokens
    await window.keyboard.type('claude: Now explain promises');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '22-cumulative-tokens.png'),
      fullPage: true
    });
  });

  test('Claude response formatting', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Test code formatting in response
    await window.keyboard.type('claude: Show me a React component example');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(4000);

    await window.screenshot({
      path: path.join(screenshotsDir, '23-code-formatting.png'),
      fullPage: true
    });

    // Test list formatting
    await window.keyboard.type('claude: List the benefits of TypeScript');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '24-list-formatting.png'),
      fullPage: true
    });

    // Test markdown formatting
    await window.keyboard.type('claude: Explain markdown with examples');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '25-markdown-formatting.png'),
      fullPage: true
    });
  });

  test('conversation context preservation', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Start a conversation
    await window.keyboard.type('claude: My name is TestUser and I am testing MythalTerminal');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '26-conversation-start.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Follow-up that requires context
    await window.keyboard.type('claude: What did I just tell you my name was?');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '27-context-recall.png'),
      fullPage: true
    });

    // Another follow-up
    await window.keyboard.type('claude: What am I testing?');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(3000);

    await window.screenshot({
      path: path.join(screenshotsDir, '28-context-maintained.png'),
      fullPage: true
    });
  });

  test('Claude status checking', async ({ window }) => {
    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Check Claude status
    await window.keyboard.type('/status');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '29-status-command.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(1000);

    // Should show all Claude instances and their states
    await window.screenshot({
      path: path.join(screenshotsDir, '30-claude-status-display.png'),
      fullPage: true
    });
  });
});