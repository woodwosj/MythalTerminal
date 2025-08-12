import { test, expect } from './setup';

test.describe('Debug Tests', () => {
  test('capture app state and HTML', async ({ electronApp, window }) => {
    // Listen for console messages before page loads
    window.on('console', msg => {
      console.log(`Console [${msg.type()}]:`, msg.text());
    });
    
    window.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
    
    // Wait a bit longer for app to fully load
    await window.waitForTimeout(3000);
    
    // Capture screenshot
    await window.screenshot({ path: 'tests/e2e/screenshots/debug-full.png' });
    
    // Get page title
    const title = await window.title();
    console.log('Page title:', title);
    
    // Get the entire HTML
    const html = await window.content();
    console.log('HTML length:', html.length);
    console.log('HTML preview:', html.substring(0, 500));
    
    // Check if any elements are visible
    const bodyVisible = await window.locator('body').isVisible();
    console.log('Body visible:', bodyVisible);
    
    // Try to get all visible text
    const visibleText = await window.locator('body').innerText();
    console.log('Visible text:', visibleText);
    
    // Check for any error messages in console
    window.on('console', msg => {
      console.log('Console:', msg.type(), msg.text());
    });
    
    // Try to find any element with content
    const anyElement = await window.locator('*').first();
    const elementInfo = await anyElement.evaluate(el => ({
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      innerHTML: el.innerHTML?.substring(0, 100)
    }));
    console.log('First element:', elementInfo);
    
    // Check if React root exists
    const reactRoot = await window.locator('#root');
    const rootExists = await reactRoot.count() > 0;
    console.log('React root exists:', rootExists);
    
    if (rootExists) {
      const rootHTML = await reactRoot.innerHTML();
      console.log('Root HTML:', rootHTML.substring(0, 500));
    }
    
    // Check URL
    const url = await window.url();
    console.log('Current URL:', url);
    
    // Basic assertion to make test pass
    expect(true).toBe(true);
  });
});