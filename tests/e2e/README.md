# E2E Testing with Playwright and MCP

## Overview

This directory contains End-to-End (E2E) tests for MythalTerminal using Playwright. We've also integrated the Playwright MCP server for enhanced automation capabilities through Claude.

## Setup

### 1. Playwright (Already Configured)
- Tests are in `*.spec.ts` files
- Configuration in `playwright.config.ts`
- Custom Electron setup in `setup.ts`

### 2. Playwright MCP Server
The Playwright MCP server is installed and configured to work with Claude Code.

```bash
# Installation (already done)
npm install --save-dev @executeautomation/playwright-mcp-server

# Configuration (in .mcp.json)
"playwright": {
  "command": "npx",
  "args": ["@executeautomation/playwright-mcp-server"]
}
```

## Running Tests

### Standard Playwright Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test tests/e2e/visual-mcp.spec.ts

# Run with headed browser (see the browser)
npx playwright test --headed
```

### Visual Testing
```bash
# Update baseline screenshots
npx playwright test --update-snapshots

# Run visual regression tests
npx playwright test visual-mcp.spec.ts
```

## Test Structure

### Basic Tests (`app.spec.ts`, `terminal.spec.ts`, `context.spec.ts`)
- Application launch and initialization
- UI element visibility
- Tab switching functionality
- Basic interactions

### Visual Tests (`visual-mcp.spec.ts`)
- Full page screenshots
- Element-specific captures
- Visual regression testing
- Responsive design testing
- Theme testing
- Performance visualization

## MCP Integration

The Playwright MCP server allows Claude to:
1. **Navigate pages** - Open URLs, click elements, fill forms
2. **Take screenshots** - Capture full page or specific elements
3. **Run assertions** - Verify element states and content
4. **Execute scripts** - Run JavaScript in the browser context
5. **Handle dialogs** - Interact with alerts, confirms, prompts

### Using MCP with Claude

When working with Claude Code, you can ask it to:
- "Take a screenshot of the current application state"
- "Navigate through all tabs and verify they work"
- "Test the terminal input functionality"
- "Check if the settings modal opens correctly"
- "Verify the visual appearance matches expectations"

## Screenshot Management

Screenshots are saved in `tests/e2e/screenshots/`:
- **Manual captures**: Named screenshots from test runs
- **Baseline images**: Reference images for visual regression
- **Diff images**: Showing differences when tests fail

### Visual Regression Testing

1. **Generate baselines**: First run creates reference images
2. **Compare changes**: Subsequent runs compare against baselines
3. **Update baselines**: Use `--update-snapshots` when UI changes are intentional

## Best Practices

1. **Wait for stability**: Use `waitForLoadState()` and `waitForTimeout()` appropriately
2. **Disable animations**: Set `animations: 'disabled'` for consistent screenshots
3. **Use descriptive names**: Name screenshots clearly for easy identification
4. **Clean up resources**: Always close browsers and clean up after tests
5. **Cross-platform testing**: Be aware of rendering differences across OS

## Troubleshooting

### Common Issues

1. **Electron window not found**
   - Ensure the app is built: `npm run build`
   - Check that main process file exists at `dist/main/index.js`

2. **Screenshots differ**
   - OS font rendering differences
   - Animation timing issues
   - Dynamic content (timestamps, etc.)

3. **MCP server not responding**
   - Restart Claude Code
   - Check `.mcp.json` configuration
   - Verify server is installed: `npm ls @executeautomation/playwright-mcp-server`

## CI/CD Integration

For CI environments:
1. Use headless mode (default)
2. Install system dependencies for Chromium
3. Store screenshots as artifacts
4. Consider using Docker for consistent rendering

```yaml
# Example GitHub Actions config
- name: Run E2E tests
  run: |
    npm run build
    npm run test:e2e
- uses: actions/upload-artifact@v3
  if: failure()
  with:
    name: test-screenshots
    path: tests/e2e/screenshots/
```