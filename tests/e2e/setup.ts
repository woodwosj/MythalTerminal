import { _electron as electron } from 'playwright';
import { test as base } from '@playwright/test';
import path from 'path';

export const test = base.extend({
  electronApp: async ({}, use) => {
    // Build path to the main electron file
    const electronPath = path.join(__dirname, '../../dist/main/index.js');
    
    // Launch Electron app
    const app = await electron.launch({
      args: [electronPath, '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    
    // Use the app in tests
    await use(app);
    
    // Clean up
    await app.close();
  },
  
  window: async ({ electronApp }, use) => {
    // Get the first window that opens
    const window = await electronApp.firstWindow();
    
    // Wait for the window to be ready
    await window.waitForLoadState('domcontentloaded');
    
    // Use the window in tests
    await use(window);
  },
});

export { expect } from '@playwright/test';