import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function realVideo() {
  const source = fs.readFileSync(path.join(process.cwd(), 'qa/gemini-proof-red-gloves-tiny.b64'), 'utf8').replace(/\s+/g, '');
  return { name: 'agent-sparring.mp4', mimeType: 'video/mp4', buffer: Buffer.from(source, 'base64') };
}

async function markVisibleFighter(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('preview-status')).toContainText('AHORA MARCA A TU PELEADOR', { timeout: 15_000 });
  await page.getByTestId('mark-fighter').click();
  const overlay = page.getByTestId('marker-overlay');
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  expect(box).not.toBeNull();
  await overlay.click({ position: { x: Math.round((box?.width || 100) * .72), y: Math.round((box?.height || 100) * .58) } });
  await expect(page.getByText(/Peleador marcado en/)).toBeVisible();
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
  await expect.poll(async () => evidenceVideo.evaluate((node: HTMLVideoElement) => (
    node.readyState >= 2 && node.videoWidth > 0 && node.videoHeight > 0 && node.currentTime > .5
  )), { timeout: 10_000 }).toBe(true);
  await expect(page.getByTestId('print-report')).toContainText('PDF');
});

test('real video decodes to a visible selection frame and fighter can be circled', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  const preview = page.getByTestId('video-preview');
  await expect(preview).toBeVisible();
  await expect(page.getByTestId('preview-status')).toContainText('AHORA MARCA A TU PELEADOR', { timeout: 15_000 });
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

test('browser uses multipart S3 then a durable uploaded-file analysis job', async ({ page }) => {
  const video = realVideo();
  let directUploadSeen = false;
  let uploadedAnalysisSeen = false;
  let multipartAnalyzeSeen = false;

  await page.route('**/api/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, backendConfigured: false, geminiConfigured: true, analysisReady: true }),
  }));
  await page.route('**/api/direct-upload**', async route => {
    directUploadSeen = true;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === 'start') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/qa.mp4', uploadId: 'qa-upload' }) });
    if (body.action === 'sign') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://upload.invalid/part' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/qa.mp4' }) });
  });
  await page.route('https://upload.invalid/**', async route => route.fulfill({ status: 200, headers: { etag: '"qa-part"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' } }));
  await page.route('**/api/analyze-uploaded**', async route => {
    uploadedAnalysisSeen = true;
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      expect(payload.s3Key).toBe('uploads/qa.mp4');
      expect(payload.glove_color).toBe('rojos');
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'qa-job', status: 'queued' }) });
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'complete',
        report: {
          mode: 'real', provider: 'Gemini', usedInReport: true,
          targetIdentity: { requestedGloves: 'rojos', observedGloves: 'rojos', anchorMatch: 'confirmed', confidence: .96, notes: 'Coincide con el ancla visual.' },
          summary: 'QA streamed browser path verified.',
          strengths: ['Presión útil con jab'], priorities: ['Salir por ángulo'], opponent: ['Cede al jab'], plan: ['Jab y pivote'],
          drills: ['Step-jab + pivote · 3×2 min'],
          evidence: [{ time: '00:02', title: 'Entrada', observation: 'Entrada visible', correction: 'Cerrar con la base antes del golpe', targetMatch: true, identityBasis: 'Guantes rojos coinciden con la referencia.' }],
        },
      }),
    });
  });
  await page.route('**/api/analyze', async route => { multipartAnalyzeSeen = true; await route.abort(); });

  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(video);
  await markVisibleFighter(page);
  await page.getByTestId('glove-color').fill('rojos');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('QA streamed browser path verified.', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(directUploadSeen).toBe(true);
  expect(uploadedAnalysisSeen).toBe(true);
  expect(multipartAnalyzeSeen).toBe(false);
  await expect(page.getByTestId('provider-badge')).toContainText('GEMINI');
  await expect(page.getByTestId('target-identity-badge')).toContainText('PELEADOR ANALIZADO · GUANTES ROJOS · IDENTIDAD CONFIRMADA · 96% CONFIANZA');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('target-identity-badge')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expect(page.getByTestId('pipeline-timings')).toContainText('Carga');
});

test('client rejects a report that switched from red gloves to the black-gloves opponent', async ({ page }) => {
  const video = realVideo();
  await page.route('**/api/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, backendConfigured: false, geminiConfigured: true, analysisReady: true }),
  }));
  await page.route('**/api/direct-upload**', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === 'start') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/identity.mp4', uploadId: 'identity-upload' }) });
    if (body.action === 'sign') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://upload.invalid/identity' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/identity.mp4' }) });
  });
  await page.route('https://upload.invalid/**', route => route.fulfill({
    status: 200,
    headers: { etag: '"identity-part"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' },
  }));
  await page.route('**/api/analyze-uploaded**', route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'identity-job', status: 'queued' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'complete',
      report: {
        mode: 'real', provider: 'Gemini', usedInReport: true,
        targetIdentity: { requestedGloves: 'rojos', observedGloves: 'negros', anchorMatch: 'conflict', confidence: .93, notes: 'La salida corresponde al rival.' },
        summary: 'Informe incorrecto sobre el rival.', strengths: ['Guardia alta'], priorities: ['Presión'], opponent: [], plan: [], drills: [], evidence: [],
      },
    }) });
  });

  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(video);
  await markVisibleFighter(page);
  await page.getByTestId('glove-color').fill('rojos');
  await page.getByTestId('analyze-button').click();
  await expect(page.locator('.error[role="alert"]')).toContainText('El reporte no coincide con el peleador seleccionado (rojos). Gemini observó guantes negros.', { timeout: 20_000 });
  await expect(page.getByTestId('report-content')).toHaveCount(0);
});

test('mobile upload falls back to same-origin proxy when signed S3 PUT fails', async ({ page }) => {
  const video = realVideo();
  let proxySeen = false;
  let completeParts: unknown[] = [];

  await page.route('**/api/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, backendConfigured: false, geminiConfigured: true, analysisReady: true }),
  }));
  await page.route('**/api/direct-upload**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('proxy') === '1') {
      proxySeen = true;
      expect(route.request().postDataBuffer()?.byteLength || 0).toBeGreaterThan(0);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ETag: '"proxy-part"', PartNumber: 1 }) });
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === 'start') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/proxy.mp4', uploadId: 'proxy-upload' }) });
    if (body.action === 'sign') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://upload.invalid/proxy-fail' }) });
    if (body.action === 'complete') {
      completeParts = body.parts as unknown[];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/proxy.mp4' }) });
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'unexpected' }) });
  });
  await page.route('https://upload.invalid/**', route => route.abort('failed'));
  await page.route('**/api/analyze-uploaded**', async route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'proxy-job', status: 'queued' }) });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 'complete', report: {
        mode: 'real', provider: 'Gemini', usedInReport: true, summary: 'Fallback móvil verificado.',
        targetIdentity: { requestedGloves: 'rojos', observedGloves: 'rojos', anchorMatch: 'confirmed', confidence: .96, notes: 'Coincide con los guantes declarados.' },
        strengths: ['Jab'], priorities: ['Ángulo'], opponent: ['Retrocede'], plan: ['Jab y pivote'], drills: ['Pivote · 3×2 min'],
        evidence: [{ time: '00:02', title: 'Entrada', observation: 'Visible', correction: 'Salir por ángulo', targetMatch: true, identityBasis: 'Guantes rojos coinciden con la referencia.' }],
      } }),
    });
  });

  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(video);
  await markVisibleFighter(page);
  await page.getByTestId('glove-color').fill('rojos');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Fallback móvil verificado.', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(proxySeen).toBe(true);
  expect(completeParts).toEqual([{ ETag: '"proxy-part"', PartNumber: 1 }]);
});

test('a transient durable-job failure retries without uploading the video again', async ({ page }) => {
  const video = realVideo();
  let uploadCalls = 0;
  let analysisCalls = 0;

  await page.route('**/api/health', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ backendConfigured: false, geminiConfigured: true, analysisReady: true }),
  }));
  await page.route('**/api/direct-upload**', async route => {
    uploadCalls += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === 'start') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/retry.mp4', uploadId: 'retry-upload' }) });
    if (body.action === 'sign') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://upload.invalid/retry' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'uploads/retry.mp4' }) });
  });
  await page.route('https://upload.invalid/**', async route => route.fulfill({ status: 200, headers: { etag: '"retry-part"', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag' } }));
  await page.route('**/api/analyze-uploaded**', async route => {
    analysisCalls += 1;
    if (route.request().method() === 'POST') return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'retry-job', status: 'queued' }) });
    if (analysisCalls === 2) {
      return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ status: 'failed', error: 'Gemini se está preparando; intenta de nuevo.' }) });
    }
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        status: 'complete',
        report: {
          mode: 'real', provider: 'Gemini', usedInReport: true, summary: 'Reintento sin segunda carga verificado.',
          targetIdentity: { requestedGloves: 'rojos', observedGloves: 'rojos', anchorMatch: 'confirmed', confidence: .95, notes: 'Coincide con los guantes declarados.' },
          strengths: ['Jab'], priorities: ['Salir por ángulo'], opponent: ['Cede al jab'], plan: ['Jab y pivote'], drills: ['Pivote · 3×2 min'],
          evidence: [{ time: '00:02', title: 'Entrada', observation: 'Entrada visible', correction: 'Cerrar con la base', targetMatch: true, identityBasis: 'Guantes rojos coinciden con la referencia.' }],
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(video);
  await markVisibleFighter(page);
  await page.getByTestId('glove-color').fill('rojos');
  await page.getByTestId('analyze-button').click();
  const retry = page.getByTestId('retry-uploaded-analysis');
  await expect(retry).toBeVisible({ timeout: 20_000 });
  expect(uploadCalls).toBe(3);
  await retry.click();
  await expect(page.getByText('Reintento sin segunda carga verificado.', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(uploadCalls).toBe(3);
  expect(analysisCalls).toBe(4);
  await expect(retry).toHaveCount(0);
});

test('a stale local verification stops instead of polling indefinitely', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ localMode: true, geminiConfigured: true, analysisReady: true }),
  }));
  await page.route('**/api/preview-frame**', route => {
    if (route.request().method() === 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: true }) });
    return route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: { 'x-fight-ai-staged-video': 'qa-staged-timeout' },
      body: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==', 'base64'),
    });
  });
  await page.route('**/api/analyze**', route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'stale-verify-job', status: 'queued' }) });
    return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'verifying', updatedAt: Date.now() - 5 * 60 * 1000 }) });
  });

  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  await markVisibleFighter(page);
  await page.getByTestId('glove-color').fill('rojos');
  await page.getByTestId('analyze-button').click();
  await expect(page.locator('.error[role="alert"]')).toContainText('La verificación visual dejó de avanzar', { timeout: 10_000 });
  await expect(page.getByTestId('processing-state')).toHaveCount(0);
});

test('a stale Gemini coaching phase stops instead of waiting 16 minutes', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ localMode: true, geminiConfigured: true, analysisReady: true }),
  }));
  await page.route('**/api/preview-frame**', route => {
    if (route.request().method() === 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: true }) });
    return route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: { 'x-fight-ai-staged-video': '12345678-1234-1234-1234-123456789abc' },
      body: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==', 'base64'),
    });
  });
  await page.route('**/api/upload**', route => route.fulfill({ status: 200, headers: { 'x-fight-ai-staged-video': '12345678-1234-1234-1234-123456789abc' } }));
  await page.route('**/api/analyze**', route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'stale-coaching' }) });
    return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'coaching', updatedAt: Date.now() - 5 * 60 * 1000 }) });
  });

  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  await markVisibleFighter(page);
  await page.getByTestId('glove-color').fill('rojos');
  await page.getByTestId('analyze-button').click();
  await expect(page.locator('.error[role="alert"]')).toContainText('Gemini no respondió dentro del límite', { timeout: 10_000 });
  await expect(page.getByTestId('processing-state')).toHaveCount(0);
});

test('virtual athlete can identify fighter choose coach focus submit analysis and replay uploaded evidence', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ localMode: true, geminiConfigured: true, analysisReady: true }),
  }));
  // This journey verifies the browser's local async-job contract. Keep frame
  // staging deterministic here instead of depending on FFmpeg being installed
  // on the GitHub runner; frame decoding has its own browser journey above.
  await page.route('**/api/preview-frame**', route => {
    if (route.request().method() === 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deleted: true }) });
    return route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      headers: { 'x-fight-ai-staged-video': 'qa-staged-video' },
      body: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==', 'base64'),
    });
  });
  await page.route('**/api/analyze**', async route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'local-qa-job', status: 'queued' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 'complete',
      report: {
        mode: 'real', provider: 'CV / Pose', usedInReport: true, summary: 'Mock backend contract OK',
        targetIdentity: { requestedGloves: 'azules', observedGloves: 'azules', anchorMatch: 'confirmed', confidence: .91, notes: 'Coincide con los guantes declarados.' },
        strengths: ['Jab'], priorities: ['Salir por ángulo'], opponent: ['Cede al jab'], plan: ['Jab y pivote'], drills: ['Pivote · 3×2 min'],
        evidence: [
          { time: '00:01', title: 'Entrada', observation: 'Entrada visible', correction: 'Cerrar con la base', targetMatch: true, identityBasis: 'Guantes azules coinciden con la referencia.' },
          { time: '00:02', title: 'Salida', observation: 'Salida lineal', correction: 'Pivotar tras golpear', targetMatch: true, identityBasis: 'Guantes azules coinciden con la referencia.' },
        ],
      },
    }) });
  });
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  const sourcePreview = page.getByTestId('video-preview');
  await expect(sourcePreview).toBeVisible();
  await markVisibleFighter(page);
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
  await expect.poll(async () => replay.evaluate((node: HTMLVideoElement) => (
    node.readyState >= 2 && node.videoWidth === 320 && node.videoHeight === 240 && node.currentTime > 0
  )), { timeout: 10_000 }).toBe(true);
});

test('mobile workflow keeps the pulsing next action visible through every step', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile-only guided flow assertion');
  await page.goto('/');
  await page.getByTestId('video-input').setInputFiles(realVideo());
  await expect(page.getByTestId('preview-status')).toContainText('AHORA MARCA A TU PELEADOR', { timeout: 15_000 });
  await page.getByTestId('mark-fighter').click();
  const overlay = page.getByTestId('marker-overlay');
  const box = await overlay.boundingBox();
  await overlay.click({ position: { x: Math.round((box?.width || 100) * .45), y: Math.round((box?.height || 100) * .55) } });
  await expect(page.locator('.workflowStrip .nextPulse')).toContainText('Características');
  await page.getByTestId('glove-color').fill('rojos');
  await expect(page.locator('.workflowStrip .nextPulse')).toContainText('Foco del coach');
  await page.getByTestId('focus-footwork').click();
  const active = page.locator('.workflowStrip .nextPulse');
  await expect(active).toContainText('Analizar sparring');
  await expect.poll(async () => active.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  })).toBe(true);
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
