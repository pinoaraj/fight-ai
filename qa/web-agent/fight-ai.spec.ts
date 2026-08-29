import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function realVideo() {
  const source = fs.readFileSync(path.join(process.cwd(), 'qa/gemini-proof-red-gloves-tiny.b64'), 'utf8').replace(/\s+/g, '');
  return { name: 'agent-sparring.mp4', mimeType: 'video/mp4', buffer: Buffer.from(source, 'base64') };
}

test('virtual athlete can navigate rich demo coaching report with playable evidence', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Tu sparring/i })).toBeVisible();
  await page.getByTestId('demo-report-button').click();
  await expect(page.getByTestId('report-content')).toBeVisible();
  await expect(page.getByText('DIAGNÓSTICO PRINCIPAL', { exact: true })).toBeVisible();
  await expect(page.getByTestId('provider-badge')).toContainText('NO PARTICIPÓ');
  await expect(page.getByTestId('report-content').getByText('VISUAL COACH', { exact: true })).toBeVisible();
  await expect(page.getByText('VIDEOS DE CORRECCIÓN', { exact: true })).toBeVisible();
  await expect(page.getByTestId('printable-diagrams')).toBeVisible();
  await expect(page.getByTestId('demo-video-section')).toBeVisible();
  const demoVideo = page.getByTestId('demo-video');
  await expect(demoVideo).toBeVisible();
  await expect.poll(async () => demoVideo.evaluate((node: HTMLVideoElement) => node.readyState), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  const demoMedia = await demoVideo.evaluate((node: HTMLVideoElement) => ({ width: node.videoWidth, height: node.videoHeight }));
  expect(demoMedia.width).toBeGreaterThan(0);
  expect(demoMedia.height).toBeGreaterThan(0);

  const evidence = page.getByTestId('evidence-item').first();
  await expect(evidence).toBeVisible();
  await evidence.click();
  const evidenceVideo = page.getByTestId('evidence-video');
  await expect(evidenceVideo).toBeVisible();
  await page.getByTestId('replay-selected').click();
  await expect.poll(async () => evidenceVideo.evaluate((node: HTMLVideoElement) => node.currentTime), { timeout: 10_000 }).toBeGreaterThan(.5);
  await expect(page.getByTestId('print-report')).toContainText('PDF');
});

test('real video decodes to a visible selection frame and fighter can be circled', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  const preview = page.getByTestId('video-preview');
  await expect(preview).toBeVisible();
  await expect(page.getByTestId('preview-status')).toContainText('FRAME VISIBLE LISTO', { timeout: 15_000 });
  const media = await preview.evaluate((node: HTMLVideoElement) => ({ readyState: node.readyState, width: node.videoWidth, height: node.videoHeight, time: node.currentTime }));
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

test('virtual athlete can identify fighter choose coach focus submit analysis and replay uploaded evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  const sourcePreview = page.getByTestId('video-preview');
  await expect(sourcePreview).toBeVisible();
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
  await expect(page.getByTestId('printable-diagrams')).toBeVisible();

  await page.getByTestId('evidence-item').first().click();
  const replay = page.getByTestId('evidence-video');
  await expect(replay).toBeVisible();
  await page.getByTestId('replay-selected').click();
  await expect.poll(async () => replay.evaluate((node: HTMLVideoElement) => ({
    readyState: node.readyState,
    width: node.videoWidth,
    height: node.videoHeight,
    time: node.currentTime,
  })), { timeout: 10_000 }).toMatchObject({ width: 320, height: 240 });
  const replayState = await replay.evaluate((node: HTMLVideoElement) => ({ readyState: node.readyState, time: node.currentTime }));
  expect(replayState.readyState).toBeGreaterThanOrEqual(2);
  expect(replayState.time).toBeGreaterThan(0);
});

test('mobile agent sees touch-safe single-column flow without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only layout assertion');
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBeFalsy();
  await expect(page.getByTestId('upload-button')).toBeVisible();
  await page.getByTestId('demo-report-button').click();
  await expect(page.getByTestId('report-content')).toBeVisible();
  const reportBox = await page.getByTestId('report-panel').boundingBox();
  expect(reportBox?.width || 0).toBeLessThanOrEqual(430);
});