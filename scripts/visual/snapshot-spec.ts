import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VIEWPORT = { width: 1600, height: 1100 };
const ARTBOARD_SELECTOR = '[data-dc-slot="ableton"] .dc-card';
const DESIGN_DEMO_PATH =
  process.env.XMS_DESIGN_DEMO ??
  resolve(process.cwd(), '../xms-design-system/01 - UI Overhaul Demo.html');

const REGIONS = [
  { name: 'topbar', clip: { x: 0, y: 0, width: 1440, height: 44 } },
  { name: 'sidebar', clip: { x: 0, y: 44, width: 240, height: 790 } },
  { name: 'workbench', clip: { x: 240, y: 44, width: 1200, height: 790 } },
  { name: 'bottombar', clip: { x: 0, y: 834, width: 1440, height: 44 } },
  { name: 'statusbar', clip: { x: 0, y: 878, width: 1440, height: 22 } }
] as const;

test.describe('Design A visual baselines', () => {
  test.use({ viewport: VIEWPORT });

  test('captures the ableton artboard regions', async ({ page }) => {
    await page.goto(pathToFileURL(DESIGN_DEMO_PATH).href, {
      waitUntil: 'networkidle',
      timeout: 90_000
    });
    await page.waitForSelector(ARTBOARD_SELECTOR, { timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready);

    const artboard = page.locator(ARTBOARD_SELECTOR);
    const box = await artboard.boundingBox();
    if (!box) {
      throw new Error('Unable to locate Design A #ableton artboard bounds.');
    }

    expect(Math.round(box.width)).toBe(1440);
    expect(Math.round(box.height)).toBe(900);

    for (const region of REGIONS) {
      await expect(page).toHaveScreenshot(`${region.name}.png`, {
        animations: 'disabled',
        clip: {
          x: box.x + region.clip.x,
          y: box.y + region.clip.y,
          width: region.clip.width,
          height: region.clip.height
        },
        maxDiffPixelRatio: 0.02
      });
    }
  });
});
