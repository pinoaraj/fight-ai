import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function realVideo() {
  const source = fs.readFileSync(path.join(process.cwd(), 'qa/gemini-proof-red-gloves-tiny.b64'), 'utf8').replace(/\s+/g, '');
  return { name: 'agent-sparring.mp4', mimeType: 'video/mp4', buffer: Buffer.from(source, 'base64') };
}

test('virtual athlete can navigate rich demo coaching report', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Tu sparring/i })).toBeVisible();
  await page.getByRole('button', { name: 'VER REPORTE DEMO' }).click();
  await expect(page.getByTestId('report-content')).toBeVisible();
  await expect(page.getByText('DIAGNÓSTICO PRINCIPAL', { exact: true })).toBeVisible();
  await expect(page.getByTestId('provider-badge')).toContainText('NO PARTICIPÓ');
  await expect(page.getByTestId('report-content').getByText('VISUAL COACH', { exact: true })).toBeVisible();
  await expect(page.getByText('VIDEOS DE CORRECCIÓN', { exact: true })).toBeVisible();
  await expect(page.getByTestId('evidence-item').first()).toBeVisible();
  await expect(page.getByTestId('print-report')).toContainText('PDF');
});

test('real video decodes to a visible selection frame and fighter can be circled', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  const preview = page.getByTestId('video-preview');
  await expect(preview).toBeVisible();
  await expect(page.getByTestId('preview-status')).toContainText('FRAME VISIBLE LISTO', { timeout: 15_000 });
  const media = await preview.evaluate((node: HTMLVideoElement) => ({
    readyState: node.readyState,
    width: node.videoWidth,
    height: node.videoHeight,
    time: node.currentTime,
  }));
  expect(media.readyState).toBeGreaterThanOrEqual(2);
  expect(media.width).toBeGreaterThan(0);
  expect(media.height).toBeGreaterThan(0);
  expect(media.time).toBeGreaterThan(0);

  await page.getByTestId('mark-fighter').click();
  const overlay = page.getByTestId('marker-overlay');
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  expect(box).not.toBeNull();
  await overlay.click({ position: { x: Math.round((box?.width || 100) * 0.45), y: Math.round((box?.height || 100) * 0.55) } });
  await expect(page.getByText(/Peleador marcado en/)).toBeVisible();
});

test('virtual athlete can identify fighter choose coach focus and submit analysis', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  await expect(page.getByTestId('video-preview')).toBeVisible();
  await page.getByTestId('glove-color').fill('azules');
  await page.getByTestId('fighter-notes').fill('polera negra, más alto, shorts verdes');
  await page.getByTestId('focus-footwork').click();
  await page.getByTestId('sport-select').selectOption('kickboxing');
  await page.getByTestId('stance-select').selectOption('southpaw');
  const analysisResponse = page.waitForResponse(response => response.url().includes('/api/analyze') && response.request().method() === 'POST');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('processing-state')).toBeVisible();
  await analysisResponse;
  await expect(page.getByTestId('report-content')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('provider-badge')).toContainText('CV / POSE');
  await expect(page.getByText('Mock backend contract OK', { exact: true })).toBeVisible();
  await expect(page.getByTestId('evidence-item')).toHaveCount(2);
  await expect(page.getByTestId('print-report')).toBeVisible();
});

test('mobile agent sees touch-safe single-column flow without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only layout assertion');
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBeFalsy();
  await expect(page.getByTestId('upload-button')).toBeVisible();
  await page.getByRole('button', { name: 'VER REPORTE DEMO' }).click();
  await expect(page.getByTestId('report-content')).toBeVisible();
  const reportBox = await page.getByTestId('report-panel').boundingBox();
  expect(reportBox?.width || 0).toBeLessThanOrEqual(430);
});