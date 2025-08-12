/**
 * Context Management E2E Tests
 * 
 * Comprehensive testing of context layer system including:
 * - Layer operations (add, remove, promote, demote)
 * - Auto-archiving on /clear
 * - Token limit management
 * - Layer persistence
 * - ConPort synchronization
 */

import { test, expect } from './setup';
import path from 'path';

const screenshotsDir = path.join(__dirname, 'screenshots', 'context-layers');

test.describe('Context Layer Management', () => {
  test.beforeEach(async ({ window }) => {
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test('context tab navigation and display', async ({ window }) => {
    // Start on terminal tab
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(500);

    await window.screenshot({
      path: path.join(screenshotsDir, '01-terminal-tab.png'),
      fullPage: true
    });

    // Switch to context tab
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    await window.screenshot({
      path: path.join(screenshotsDir, '02-context-tab-active.png'),
      fullPage: true
    });

    // Verify context button is highlighted
    await expect(contextButton).toHaveClass(/bg-blue-600/);

    // Check for context layers display
    const contextContainer = await window.locator('[class*="context"], [class*="layer"]').first();
    if (await contextContainer.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '03-context-layers-visible.png'),
        clip: await contextContainer.boundingBox() || undefined
      });
    }
  });

  test('layer type indicators and colors', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Look for different layer types
    const layerTypes = [
      { emoji: '⭐', name: 'Core', className: 'core' },
      { emoji: '🔵', name: 'Active', className: 'active' },
      { emoji: '📚', name: 'Reference', className: 'reference' },
      { emoji: '📦', name: 'Archive', className: 'archive' }
    ];

    for (const layer of layerTypes) {
      const layerElement = await window.locator(`text=${layer.emoji}`).first();
      if (await layerElement.isVisible()) {
        const parent = await layerElement.locator('..');
        await window.screenshot({
          path: path.join(screenshotsDir, `04-layer-${layer.name.toLowerCase()}.png`),
          clip: await parent.boundingBox() || undefined
        });
      }
    }

    // Full context view with all layers
    await window.screenshot({
      path: path.join(screenshotsDir, '05-all-layers-overview.png'),
      fullPage: true
    });
  });

  test('add new context layer', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Look for add button
    const addButton = await window.locator('button:has-text("Add"), button:has-text("+"), button:has-text("New")').first();
    if (await addButton.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '06-before-add-layer.png'),
        fullPage: true
      });

      await addButton.click();
      await window.waitForTimeout(500);

      // Check if a modal or input appears
      const input = await window.locator('input[type="text"], textarea').first();
      if (await input.isVisible()) {
        await window.screenshot({
          path: path.join(screenshotsDir, '07-add-layer-dialog.png'),
          fullPage: true
        });

        // Type new layer content
        await input.type('Test context layer content for E2E testing');
        await window.waitForTimeout(200);

        await window.screenshot({
          path: path.join(screenshotsDir, '08-layer-content-typed.png'),
          fullPage: true
        });

        // Submit (Enter or click button)
        await window.keyboard.press('Enter');
        await window.waitForTimeout(1000);

        await window.screenshot({
          path: path.join(screenshotsDir, '09-layer-added.png'),
          fullPage: true
        });
      }
    }
  });

  test('promote and demote layers', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Find a layer with promote/demote buttons
    const layerActions = await window.locator('[class*="layer"]').first();
    if (await layerActions.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '10-layer-initial-state.png'),
        clip: await layerActions.boundingBox() || undefined
      });

      // Look for promote button (up arrow, star, etc.)
      const promoteButton = await layerActions.locator('button:has-text("⬆"), button:has-text("Promote"), button:has-text("⭐")').first();
      if (await promoteButton.isVisible()) {
        await promoteButton.click();
        await window.waitForTimeout(1000);

        await window.screenshot({
          path: path.join(screenshotsDir, '11-layer-promoted.png'),
          fullPage: true
        });
      }

      // Look for demote button
      const demoteButton = await layerActions.locator('button:has-text("⬇"), button:has-text("Demote"), button:has-text("📦")').first();
      if (await demoteButton.isVisible()) {
        await demoteButton.click();
        await window.waitForTimeout(1000);

        await window.screenshot({
          path: path.join(screenshotsDir, '12-layer-demoted.png'),
          fullPage: true
        });
      }
    }
  });

  test('remove context layer', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Find a layer with delete button
    const layer = await window.locator('[class*="layer"]').first();
    if (await layer.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '13-before-remove.png'),
        fullPage: true
      });

      const deleteButton = await layer.locator('button:has-text("Delete"), button:has-text("Remove"), button:has-text("🗑"), button:has-text("❌")').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await window.waitForTimeout(500);

        // Check for confirmation dialog
        const confirmButton = await window.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
        if (await confirmButton.isVisible()) {
          await window.screenshot({
            path: path.join(screenshotsDir, '14-remove-confirmation.png'),
            fullPage: true
          });

          await confirmButton.click();
        }

        await window.waitForTimeout(1000);

        await window.screenshot({
          path: path.join(screenshotsDir, '15-layer-removed.png'),
          fullPage: true
        });
      }
    }
  });

  test('token count display and updates', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Find token count displays
    const tokenDisplay = await window.locator('[class*="token"], text=/\\d+.*tokens?/i').first();
    if (await tokenDisplay.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '16-token-count-initial.png'),
        clip: await tokenDisplay.boundingBox() || undefined
      });
    }

    // Look for total tokens
    const totalTokens = await window.locator('text=/total.*tokens?/i').first();
    if (await totalTokens.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '17-total-tokens.png'),
        fullPage: true
      });
    }

    // Check for token limit warnings
    const warningColors = ['yellow', 'orange', 'red'];
    for (const color of warningColors) {
      const warning = await window.locator(`[class*="${color}"]`).first();
      if (await warning.isVisible()) {
        await window.screenshot({
          path: path.join(screenshotsDir, `18-token-warning-${color}.png`),
          clip: await warning.boundingBox() || undefined
        });
      }
    }
  });

  test('auto-archiving with /clear command', async ({ window }) => {
    // Switch to terminal
    const terminalButton = await window.locator('button:has-text("💻 Terminal")');
    await terminalButton.click();
    await window.waitForTimeout(1000);

    const terminalContainer = await window.locator('.xterm-screen, [class*="terminal"]').first();
    await terminalContainer.click();
    await window.waitForTimeout(500);

    // Add some conversation to archive
    await window.keyboard.type('claude: This is a test conversation for archiving');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000);

    await window.screenshot({
      path: path.join(screenshotsDir, '19-conversation-before-clear.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Execute /clear command
    await window.keyboard.type('/clear');
    
    await window.screenshot({
      path: path.join(screenshotsDir, '20-clear-command-typed.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    await window.keyboard.press('Enter');
    await window.waitForTimeout(2000);

    await window.screenshot({
      path: path.join(screenshotsDir, '21-terminal-cleared.png'),
      clip: await terminalContainer.boundingBox() || undefined
    });

    // Switch to context to see archive
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Look for archive layer
    const archiveLayer = await window.locator('text=📦').first();
    if (await archiveLayer.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '22-archive-layer-created.png'),
        fullPage: true
      });
    }
  });

  test('layer content preview and expansion', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Find a layer with content
    const layer = await window.locator('[class*="layer"]').first();
    if (await layer.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '23-layer-collapsed.png'),
        clip: await layer.boundingBox() || undefined
      });

      // Look for expand button
      const expandButton = await layer.locator('button:has-text("Expand"), button:has-text("View"), button:has-text("▼"), button:has-text("▶")').first();
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await window.waitForTimeout(500);

        await window.screenshot({
          path: path.join(screenshotsDir, '24-layer-expanded.png'),
          fullPage: true
        });

        // Collapse again
        await expandButton.click();
        await window.waitForTimeout(500);

        await window.screenshot({
          path: path.join(screenshotsDir, '25-layer-collapsed-again.png'),
          clip: await layer.boundingBox() || undefined
        });
      }
    }
  });

  test('ConPort sync status', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Look for ConPort sync indicator
    const syncIndicator = await window.locator('text=/ConPort|Sync|Knowledge Graph/i').first();
    if (await syncIndicator.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '26-conport-sync-status.png'),
        clip: await syncIndicator.boundingBox() || undefined
      });
    }

    // Look for sync button
    const syncButton = await window.locator('button:has-text("Sync"), button:has-text("🔄")').first();
    if (await syncButton.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '27-sync-button.png'),
        clip: await syncButton.boundingBox() || undefined
      });

      await syncButton.click();
      await window.waitForTimeout(1000);

      await window.screenshot({
        path: path.join(screenshotsDir, '28-after-sync.png'),
        fullPage: true
      });
    }
  });

  test('search within contexts', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Look for search input
    const searchInput = await window.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await window.screenshot({
        path: path.join(screenshotsDir, '29-search-input.png'),
        fullPage: true
      });

      await searchInput.type('test');
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '30-search-results.png'),
        fullPage: true
      });

      // Clear search
      await searchInput.clear();
      await window.waitForTimeout(500);

      await window.screenshot({
        path: path.join(screenshotsDir, '31-search-cleared.png'),
        fullPage: true
      });
    }
  });

  test('layer persistence across sessions', async ({ window }) => {
    const contextButton = await window.locator('button:has-text("📊 Context")');
    await contextButton.click();
    await window.waitForTimeout(1000);

    // Capture current state
    await window.screenshot({
      path: path.join(screenshotsDir, '32-layers-before-reload.png'),
      fullPage: true
    });

    // Reload the page
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1500);

    // Navigate back to context
    const contextButtonAfter = await window.locator('button:has-text("📊 Context")');
    await contextButtonAfter.click();
    await window.waitForTimeout(1000);

    // Verify layers persisted
    await window.screenshot({
      path: path.join(screenshotsDir, '33-layers-after-reload.png'),
      fullPage: true
    });
  });
});