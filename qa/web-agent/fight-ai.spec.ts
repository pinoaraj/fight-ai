import { expect, test } from '@playwright/test';

const fakeVideo = { name: 'agent-sparring.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake-video') };

test('virtual athlete can navigate demo coaching report', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Tu sparring/i })).toBeVisible();
  await page.getByRole('button', { name: 'VER REPORTE DEMO' }).click();
  await expect(page.getByTestId('report-content')).toBeVisible();
  await expect(page.getByText('LO MÁS IMPORTANTE')).toBeVisible();
  await expect(page.getByTestId('provider-badge')).toContainText('IA NO USADA');
  await expect(page.getByText('VISUAL COACH')).toBeVisible();
  await expect(page.getByTestId('evidence-item').first()).toBeVisible();
  await expect(page.getByTestId('print-report')).toBeVisible();
});

test('virtual athlete can configure and submit a real analysis', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(fakeVideo);
  await expect(page.getByTestId('video-preview')).toBeVisible();
  await page.getByTestId('fighter-blue').click();
  await expect(page.getByTestId('fighter-blue')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('sport-select').selectOption('kickboxing');
  await page.getByTestId('stance-select').selectOption('southpaw');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('processing-state')).toBeVisible();
  await expect(page.getByTestId('report-content')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('provider-badge')).toContainText('CV / Pose');
  await expect(page.getByText('Mock backend contract OK')).toBeVisible();
  await expect(page.getByTestId('evidence-item')).toHaveCount(2);
});

test('mobile agent sees touch-safe single-column flow without horizontal page overflow', async ({ page }, testInfo) => {
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
