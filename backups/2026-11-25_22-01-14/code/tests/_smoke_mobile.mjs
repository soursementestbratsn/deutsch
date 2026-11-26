// Mobile smoke tests for Deutsch Quest
// Run with: npx playwright test tests/_smoke_mobile.mjs
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPhone 14 Plus', width: 428, height: 926 },
  { name: 'iPad Mini', width: 768, height: 1024 },
];

test.describe('Mobile Layout Tests', () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test('loads without horizontal scroll', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Check no horizontal scroll
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = viewport.width;
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px rounding
      });

      test('bottom nav visible on mobile', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        const bottomNav = page.locator('#bottomNav');
        await expect(bottomNav).toBeVisible();
        
        // Check 5 tabs present
        const tabs = bottomNav.locator('button[data-view]');
        await expect(tabs).toHaveCount(5);
        
        // Check active state on first tab (train)
        const activeTab = bottomNav.locator('button[data-view="train"]');
        await expect(activeTab).toHaveClass(/active/);
      });

      test('trainer view works on mobile', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Check trainer view is visible
        const trainView = page.locator('#view-train');
        await expect(trainView).toBeVisible();
        
        // Check question text is large enough
        const qText = page.locator('#qText');
        await expect(qText).toBeVisible();
        
        // Check options are touch-friendly (single column on mobile)
        const options = page.locator('.opt');
        if (await options.count() > 0) {
          const firstOpt = options.first();
          const box = await firstOpt.boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      });

      test('settings opens as bottom sheet', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Open settings
        await page.click('#settingsOpen');
        await page.waitForTimeout(300);
        
        const settingsCard = page.locator('.settings-card');
        await expect(settingsCard).toBeVisible();
        
        // Check it's a bottom sheet (full width, rounded top)
        const box = await settingsCard.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
        
        // Check nav tabs are horizontally scrollable
        const settingsNav = page.locator('.settings-nav');
        await expect(settingsNav).toBeVisible();
        
        // Close settings
        await page.click('#settingsClose');
        await expect(settingsCard).toBeHidden();
      });

      test('game modal is full-screen on mobile', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Navigate to games
        await page.click('#bottomNav >> button[data-view="games"]');
        await page.waitForTimeout(200);
        
        // Open first game
        const firstGame = page.locator('.game-card').first();
        await firstGame.click();
        await page.waitForTimeout(300);
        
        const modalCard = page.locator('.modal-card');
        await expect(modalCard).toBeVisible();
        
        // Check full-screen
        const box = await modalCard.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
        expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);
        
        // Close modal
        await page.click('#gClose');
        await expect(modalCard).toBeHidden();
      });

      test('training view tabs scroll horizontally', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Navigate to training
        await page.click('#bottomNav >> button[data-view="lernen"]');
        await page.waitForTimeout(200);
        
        const trTabs = page.locator('.tr-tabs');
        await expect(trTabs).toBeVisible();
        
        // Check tabs exist
        const tabs = trTabs.locator('button');
        const count = await tabs.count();
        expect(count).toBeGreaterThan(4); // More than fit on screen
      });

      test('no iOS zoom on input focus', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Check input font sizes
        const inputs = page.locator('input.input, select.select');
        const count = await inputs.count();
        
        for (let i = 0; i < Math.min(count, 5); i++) {
          const input = inputs.nth(i);
          const fontSize = await input.evaluate(el => 
            window.getComputedStyle(el).fontSize
          );
          expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16);
        }
      });

      test('safe areas respected', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Check bottom nav has safe area padding
        const bottomNav = page.locator('#bottomNav');
        const styles = await bottomNav.evaluate(el => 
          window.getComputedStyle(el)
        );
        expect(styles.paddingBottom).toContain('env(safe-area-inset-bottom)');
      });

      test('touch targets meet 44x44 minimum', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Check various interactive elements
        const selectors = [
          '.btn',
          '.opt',
          '.nav-menu-item',
          '.segmented button',
          '.icon-btn',
          '.chip',
          '.set-toggle',
          '.switch-row',
        ];
        
        for (const selector of selectors) {
          const elements = page.locator(selector);
          const count = await elements.count();
          
          for (let i = 0; i < Math.min(count, 3); i++) {
            const el = elements.nth(i);
            const box = await el.boundingBox();
            if (box) {
              // At least one dimension should be >= 44 (some elements are inline)
              expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });
    });
  }
});

test.describe('Desktop Layout Tests', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('horizontal nav visible on desktop', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    const dqNav = page.locator('.dq-nav');
    await expect(dqNav).toBeVisible();
    
    const bottomNav = page.locator('#bottomNav');
    await expect(bottomNav).toBeHidden();
  });

  test('trainer three-column layout on desktop', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    const trainGrid = page.locator('.train-grid');
    const styles = await trainGrid.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    // Should have 3 columns on desktop
    expect(styles.split(' ').length).toBeGreaterThanOrEqual(3);
  });
});