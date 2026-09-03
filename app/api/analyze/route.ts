import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { boxingKnowledgePrompt } from '../../../lib/boxingKnowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function secondsToClock(value: number) {
  const total = Math.max(0, Math.round(value));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function textOf(item: unknown) {
  if (!item || typeof item !== 'object') return '';
  const x = item as Record<string, unknown>;
  return [typeof x.title === 'string' ? x.title : '', typeof x.description === 'string' ? x.description : ''].filter(Boolean).join(': ');
}

function normalizeReport(raw: unknown) {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const strengthsRaw = Array.isArray(a.strengths) ? a.strengths : [];
  const weaknessesRaw = Array.isArray(a.weaknesses) ? a.weaknesses : [];
  const drillsRaw = Array.isArray(a.drills) ? a.drills : [];
  const strategy = (a.strategy && typeof a.strategy === 'object' ? a.strategy : {}) as Record<string, unknown>;
  const opponentAnalysis = (strategy.opponentAnalysis && typeof strategy.opponentAnalysis === 'object' ? strategy.opponentAnalysis : {}) as Record<string, unknown>;
  const observedOpponent = Array.isArray(opponentAnalysis.observedOpponentPatterns) ? opponentAnalysis.observedOpponentPatterns : [];
  const hypotheses = Array.isArray(opponentAnalysis.tacticalHypotheses) ? opponentAnalysis.tacticalHypotheses.filter(x => typeof x === 'string') as string[] : [];
  const rematchPlan = Array.isArray(opponentAnalysis.rematchPlan) ? opponentAnalysis.rematchPlan.filter(x => typeof x === 'string') as string[] : [];
  const goals = Array.isArray(a.nextSessionGoals) ? a.nextSessionGoals.filter(x => typeof x === 'string') as string[] : [];
  const realVision = (a.realVision && typeof a.realVision === 'object' ? a.realVision : {}) as Record<string, unknown>;
  const videoAI = (realVision.videoAI && typeof realVision.videoAI === 'object' ? realVision.videoAI : {}) as Record<string, unknown>;
  const providerUsed = videoAI.usedInReport === true;
  const provider = providerUsed && typeof videoAI.provider === 'string' ? videoAI.provider : 'CV / Pose';
  const evidence = [...weaknessesRaw, ...strengthsRaw].flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const x = item as Record<string, unknown>;
    const timestamps = Array.isArray(x.timestamps) ? x.timestamps.filter(v => typeof v === 'number') as number[] : [];
    return timestamps.map(timestamp => ({
      time: secondsToClock(timestamp),
      title: typeof x.title === 'string' ? x.title : 'Evidencia',
      observation: typeof x.description === 'string' ? x.description : '',
      correction: typeof x.recommendation === 'string' ? x.recommendation : typeof x.whyItMatters === 'string' ? x.whyItMatters : '',
    }));
  });
  return {
    mode: 'real' as const, provider, usedInReport: providerUsed,
    summary: typeof a.mainTakeaway === 'string' ? a.mainTakeaway : typeof strategy.summary === 'string' ? strategy.summary : 'Análisis completado.',
    strengths: strengthsRaw.map(textOf).filter(Boolean), priorities: weaknessesRaw.map(textOf).filter(Boolean),
    opponent: [...observedOpponent.map(textOf).filter(Boolean), ...hypotheses], plan: rematchPlan.length ? rematchPlan : goals,
    drills: drillsRaw.map(item => {
      if (!item || typeof item !== 'object') return '';
      const x = item as Record<string, unknown>;
      return `${typeof x.name === 'string' ? x.name : 'Drill'}${typeof x.duration === 'string' ? ` · ${x.duration}` : ''}${typeof x.goal === 'string' ? ` — ${x.goal}` : ''}`;
    }).filter(Boolean), evidence,
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (process.env.FIGHT_AI_WEB_TOKEN) headers.set('Authorization', `Bearer ${process.env.FIGHT_AI_WEB_TOKEN}`);
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error(`Respuesta inválida del motor (${response.status}).`); }
  if (!response.ok) throw new Error((data as { error?: string })?.error || text || `HTTP ${response.status}`);
  return data;
}

function cleanGeminiJson(text: string) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()) as Record<string, unknown>;
}

const coachingSchema = {
  type: 'object', properties: {
    summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, priorities: { type: 'array', items: { type: 'string' } },
    opponent: { type: 'array', items: { type: 'string' } }, plan: { type: 'array', items: { type: 'string' } }, drills: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'object', properties: {
      time: { type: 'string' }, title: { type: 'string' }, observation: { type: 'string' }, correction: { type: 'string' },
    }, required: ['time','title','observation','correction'] } },
  }, required: ['summary','strengths','priorities','opponent','plan','drills','evidence'],
};

function interactionOutputText(raw: unknown) {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.steps)) return '';
  const chunks: string[] = [];
  for (const step of data.steps) {
    if (!step || typeof step !== 'object' || !Array.isArray((step as Record<string, unknown>).content)) continue;
    for (const item of (step as { content: unknown[] }).content) if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string') chunks.push((item as { text: string }).text);
  }
  return chunks.join('').trim();
}

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = Array.from(new Set([configured || '', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(Boolean)));
  let lastStatus = 0; let retryAfter = 0;
  for (const model of candidates) {
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [{ type: 'video', uri: fileUri, mime_type: mimeType }, { type: 'text', text: prompt }], response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema }, store: false }), cache: 'no-store',
          signal: AbortSignal.timeout(4 * 60 * 1000),
        });
      } catch {
        lastStatus = 0;
        if (attempt + 1 < maxAttempts) { await sleep(5000); continue; }
        break;
      }
      lastStatus = response.status; retryAfter = Number(response.headers.get('retry-after') || 0); const body = await response.text();
      if (response.ok) {
        const text = interactionOutputText(JSON.parse(body) as unknown);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }
      if ([429,500,502,503,504].includes(response.status) && attempt + 1 < maxAttempts) {
        await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  if ([0,429,500,502,503,504].includes(lastStatus)) {
    throw new Error('Gemini está temporalmente ocupado. El video sigue seguro; vuelve a intentar el análisis en un momento.');
  }
  throw new Error(`Gemini rechazó el análisis (${lastStatus}).`);
}

function field(source: FormData, key: string, fallback = '') { return String(source.get(key) || fallback).trim(); }

function makeThreeMinuteClip(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-hide_banner','-loglevel','error','-y','-i',inputPath,'-t','180',
      '-map','0:v:0?','-map','0:a?','-c','copy','-movflags','+faststart',outputPath,
    ], { stdio: ['ignore','ignore','pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('El recorte local tardó demasiado.')); }, 90_000);
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('FFmpeg no está disponible en este PC.')); });
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'No se pudo preparar el round local.'));
    });
  });
}

function makeCompactCompatibleClip(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-hide_banner','-loglevel','error','-y','-i',inputPath,'-t','180',
      '-map','0:v:0?','-map','0:a?','-vf','scale=-2:540',
      '-c:v','libx264','-preset','veryfast','-crf','30','-pix_fmt','yuv420p',
      '-c:a','aac','-b:a','96k','-movflags','+faststart',outputPath,
    ], { stdio: ['ignore','ignore','pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('La conversión local tardó demasiado.')); }, 4 * 60_000);
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('FFmpeg no está disponible en este PC.')); });
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'No se pudo convertir el round local.'));
    });
  });
}


async function analyzeWithGemini(source: FormData, updateStatus?: (status: string) => void | Promise<void>) {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini no está configurado en el servidor local.');
  const video = source.get('video');
  const stagedVideoId = field(source, 'staged_video_id');
  const hasStagedVideo = /^[a-f0-9-]{16,64}$/i.test(stagedVideoId);
  if (!hasStagedVideo && (!(video instanceof File) || !video.size)) throw new Error('No se recibió un video válido.');

  const inputPath = hasStagedVideo
    ? join(tmpdir(), `fight-ai-staged-${stagedVideoId}.mp4`)
    : join(tmpdir(), `fight-ai-local-source-${randomUUID()}.mp4`);
  const clipPath = join(tmpdir(), `fight-ai-local-round-${randomUUID()}.mp4`);
  const videoName = hasStagedVideo ? field(source, 'video_name', 'fight-ai-sparring.mp4') : (video as File).name || 'fight-ai-sparring.mp4';
  let originalSize = hasStagedVideo ? Number(field(source, 'video_size', '0')) || 0 : (video as File).size;
  let preprocessingMs = 0;
  let uploadMs = 0;
  let processingMs = 0;

  try {
    await updateStatus?.('preprocessing');
    const preprocessingStarted = Date.now();
    if (hasStagedVideo) {
      const staged = await stat(inputPath);
      if (!staged.size || staged.size > 750 * 1024 * 1024) throw new Error('El video preparado no es válido o expiró. Genera nuevamente el frame compatible.');
      originalSize = staged.size;
    } else {
      const uploadedVideo = video as File;
      await pipeline(
        Readable.fromWeb(uploadedVideo.stream() as import('stream/web').ReadableStream),
        createWriteStream(inputPath, { flags: 'wx' }),
      );
    }
    await makeThreeMinuteClip(inputPath, clipPath);
    let clip = await stat(clipPath);
    if (!clip.size) throw new Error('El clip local de 3 minutos quedó vacío.');

    // Keep stream-copy as the fast path. Only large/high-bitrate phone videos
    // are compacted once on the user's PC before Gemini sees them.
    if (clip.size > 45 * 1024 * 1024) {
      await unlink(clipPath).catch(() => undefined);
      await makeCompactCompatibleClip(inputPath, clipPath);
      clip = await stat(clipPath);
      if (!clip.size) throw new Error('El clip compatible local quedó vacío.');
    }
    preprocessingMs = Date.now() - preprocessingStarted;

    const mimeType = 'video/mp4';
    await updateStatus?.('uploading');
    const uploadStarted = Date.now();
    let startUpload: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      startUpload = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(clip.size),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: `local-3min-${videoName}`.slice(0, 160) } }),
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      });
      if (startUpload.ok) break;
      if (![429,500,502,503,504].includes(startUpload.status)) break;
      if (attempt < 2) await sleep(5000 * (attempt + 1));
    }
    if (!startUpload?.ok) throw new Error(`Gemini no pudo iniciar la carga local (${startUpload?.status || 0}).`);
    const uploadUrl = startUpload.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('Gemini no devolvió URL de carga.');

    const body = Readable.toWeb(createReadStream(clipPath) as Readable);
    const uploaded = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(clip.size),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(4 * 60_000),
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    if (!uploaded.ok) throw new Error(`Gemini no pudo cargar el clip local (${uploaded.status}).`);
    uploadMs = Date.now() - uploadStarted;

    const fileInfo = await uploaded.json() as { file?: { name?: string; uri?: string; state?: string } };
    const fileName = fileInfo.file?.name; const fileUri = fileInfo.file?.uri;
    if (!fileName || !fileUri) throw new Error('Gemini no devolvió referencia del video.');

    await updateStatus?.('preparing');
    const processingStarted = Date.now();
    let state = fileInfo.file?.state || 'PROCESSING';
    const deadline = Date.now() + 8 * 60_000;
    while (state !== 'ACTIVE' && Date.now() < deadline) {
      if (state === 'FAILED') throw new Error('Gemini no pudo preparar el video.');
      await sleep(1800);
      const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
        headers: { 'x-goog-api-key': apiKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
      if (!status.ok) throw new Error(`No se pudo consultar el estado del video en Gemini (${status.status}).`);
      state = (await status.json() as { state?: string }).state || 'PROCESSING';
    }
    if (state !== 'ACTIVE') throw new Error('Gemini tardó demasiado en preparar el video.');
    processingMs = Date.now() - processingStarted;

    const language = field(source, 'language', 'es');
    const sport = field(source, 'sport', 'boxing');
    const stance = field(source, 'stance', 'unknown');
    const descriptors = [
      field(source,'glove_color') && `guantes/diseño ${field(source,'glove_color')}`,
      field(source,'top_color') && `ropa ${field(source,'top_color')}`,
      field(source,'relative_height') && `altura relativa ${field(source,'relative_height')}`,
      field(source,'build') && `contextura ${field(source,'build')}`,
      field(source,'fighter_notes'),
    ].filter(Boolean).join('; ');
    const anchorTime = Number(field(source,'anchor_time','0')) || 0;
    const anchor = field(source,'anchor_x') && field(source,'anchor_y')
      ? `El usuario marcó al peleador en t=${anchorTime.toFixed(1)}s cerca de x=${field(source,'anchor_x')}%, y=${field(source,'anchor_y')}%. Usa ese momento como ancla visual y mantén la identidad por continuidad temporal.`
      : 'Mantén la identidad usando las características visibles y continuidad temporal.';
    const focuses = field(source,'analysis_focus','technique,weaknesses,strategy');
    const customFocus = field(source,'custom_focus');
    const languageInstruction = language === 'en' ? 'Write the entire report in English.' : 'Escribe todo el reporte en español natural.';
    const knowledge = boxingKnowledgePrompt([focuses, customFocus, descriptors, stance, sport].join(' '), 6);

    const prompt = `Actúa como un entrenador de boxeo/kickboxing de alto nivel haciendo una revisión clínica post-sparring. ${languageInstruction}

MOTOR HÍBRIDO FIGHT AI:
${knowledge.text}

La base acelera el razonamiento, pero NO decide el diagnóstico. Mira el video y acepta, modifica o descarta cada fundamento según este atleta, este rival y este momento. Cada conclusión final debe nacer de evidencia visible.

VIDEO Y OBJETIVO:
- Disciplina: ${sport}.
- Guardia declarada del atleta: ${stance}.
- Peleador objetivo: ${descriptors || 'peleador seleccionado por el usuario'}.
- ${anchor}
- Si la identidad se vuelve dudosa, NO cambies de peleador silenciosamente: usa solo momentos en que estés seguro.

FOCO PEDIDO POR EL ATLETA:
- Áreas: ${focuses}.
- Objetivo personalizado: ${customFocus || 'ninguno adicional'}.

ESTÁNDAR DE COACHING:
1. No hagas comentarios genéricos. Busca patrones repetidos y explica el contexto exacto.
2. Para cada prioridad conecta QUÉ sucede visualmente → POR QUÉ probablemente sucede → consecuencia técnica/táctica → CÓMO corregirlo.
3. Distingue hechos visibles de hipótesis. No inventes conteos, porcentajes, velocidad, precisión ni estadísticas.
4. Revisa guardia/recuperación, base/balance, transferencia de peso, entradas, salidas, head movement, defensa tras combinación, distancia, timing, ángulos/pivotes, footwork, selección de golpes, ritmo, presión, reacción al jab, cuerpo y decisiones bajo presión cuando sean visibles.
5. Lee al rival: rango preferido, reacciones recurrentes, patrones, qué explota del atleta y qué vulnerabilidades ofrece.
6. Prioriza SOLO las 3 correcciones con mayor impacto.
7. Las fortalezas deben explicar cómo explotarlas estratégicamente.
8. Cada drill debe estar ligado a una prioridad concreta e incluir estructura práctica y objetivo.
9. evidence debe usar timestamps MM:SS realmente visibles, distribuidos en el round.
10. summary debe ser un diagnóstico específico, no una plantilla ni una descripción de una escuela nacional.

Devuelve exclusivamente JSON válido con summary, strengths, priorities, opponent, plan, drills y evidence.`;

    await updateStatus?.('coaching');
    const analysisStarted = Date.now();
    const parsed = await generateCoachJson(apiKey, prompt, fileUri, mimeType);
    const analysisMs = Date.now() - analysisStarted;
    const stringList = (value: unknown) => Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()) as string[] : [];
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter(x => x && typeof x === 'object').map(x => {
      const item = x as Record<string, unknown>;
      return {
        time: typeof item.time === 'string' ? item.time : '00:00',
        title: typeof item.title === 'string' ? item.title : 'Evidencia',
        observation: typeof item.observation === 'string' ? item.observation : '',
        correction: typeof item.correction === 'string' ? item.correction : '',
      };
    }).filter(x => /^\d{1,2}:\d{2}$/.test(x.time) && x.observation) : [];

    return {
      mode: 'real' as const,
      provider: 'Gemini',
      usedInReport: true,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado con Gemini.',
      strengths: stringList(parsed.strengths),
      priorities: stringList(parsed.priorities).slice(0,3),
      opponent: stringList(parsed.opponent),
      plan: stringList(parsed.plan),
      drills: stringList(parsed.drills),
      evidence,
      timings: {
        preprocessing_ms: preprocessingMs,
        gemini_upload_ms: uploadMs,
        gemini_processing_ms: processingMs,
        analysis_ms: analysisMs,
        total_ms: Date.now() - startedAt,
        original_size_bytes: originalSize,
        processed_size_bytes: clip.size,
        clip_count: 1,
      },
      knowledge: { version: knowledge.version, matched: knowledge.ids },
    };
  } finally {
    await Promise.all([
      unlink(inputPath).catch(() => undefined),
      unlink(clipPath).catch(() => undefined),
    ]);
  }
}


type LocalJob = {
  id: string;
  status: 'queued' | 'preprocessing' | 'uploading' | 'preparing' | 'coaching' | 'complete' | 'failed';
  updatedAt: number;
  report?: unknown;
  error?: string;
};

function localJobPath(id: string) {
  return join(tmpdir(), `fight-ai-local-job-${id}.json`);
}

async function writeLocalJob(job: LocalJob) {
  await writeFile(localJobPath(job.id), JSON.stringify(job), 'utf8');
}

async function readLocalJob(id: string): Promise<LocalJob | null> {
  if (!/^[a-f0-9-]{16,64}$/i.test(id)) return null;
  try {
    return JSON.parse(await readFile(localJobPath(id), 'utf8')) as LocalJob;
  } catch {
    return null;
  }
}

async function prepareLocalAsyncSource(source: FormData) {
  const prepared = new FormData();
  for (const [key, value] of source.entries()) {
    if (key === 'video' || key === 'staged_video_id' || key === 'video_name' || key === 'video_size') continue;
    if (typeof value === 'string') prepared.append(key, value);
  }

  const existingStaged = field(source, 'staged_video_id');
  if (/^[a-f0-9-]{16,64}$/i.test(existingStaged)) {
    prepared.append('staged_video_id', existingStaged);
    prepared.append('video_name', field(source, 'video_name', 'fight-ai-sparring.mp4'));
    prepared.append('video_size', field(source, 'video_size', '0'));
    return prepared;
  }

  const video = source.get('video');
  if (!(video instanceof File) || !video.size) throw new Error('No se recibió un video válido.');
  const stagedId = randomUUID();
  const stagedPath = join(tmpdir(), `fight-ai-staged-${stagedId}.mp4`);
  await pipeline(
    Readable.fromWeb(video.stream() as import('stream/web').ReadableStream),
    createWriteStream(stagedPath, { flags: 'wx' }),
  );
  prepared.append('staged_video_id', stagedId);
  prepared.append('video_name', video.name || 'fight-ai-sparring.mp4');
  prepared.append('video_size', String(video.size));
  return prepared;
}

async function runLocalJob(id: string, source: FormData) {
  const update = async (status: LocalJob['status']) => {
    await writeLocalJob({ id, status, updatedAt: Date.now() });
  };
  try {
    await update('preprocessing');
    const report = await analyzeWithGemini(source, async (status) => {
      if (['preprocessing','uploading','preparing','coaching'].includes(status)) {
        await update(status as LocalJob['status']);
      }
    });
    await writeLocalJob({ id, status: 'complete', updatedAt: Date.now(), report });
  } catch (error) {
    console.error('Fight AI local async analysis error', error);
    await writeLocalJob({
      id,
      status: 'failed',
      updatedAt: Date.now(),
      error: error instanceof Error ? error.message : 'No se pudo completar el análisis.',
    });
  }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || '';
  const job = await readLocalJob(id);
  if (!job) return NextResponse.json({ error: 'El trabajo local no existe o ya expiró.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (job.status === 'complete') return NextResponse.json({ status: job.status, report: job.report, updatedAt: job.updatedAt }, { headers: { 'Cache-Control': 'no-store' } });
  if (job.status === 'failed') return NextResponse.json({ status: job.status, error: job.error, updatedAt: job.updatedAt }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ status: job.status, updatedAt: job.updatedAt }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  try {
    const source = await req.formData();
    const localMode = (process.env.FIGHT_AI_RUNTIME || 'cloud').trim().toLowerCase() === 'local';
    const backend = localMode ? '' : process.env.FIGHT_AI_API_URL?.replace(/\/$/, '');

    if (localMode && new URL(req.url).searchParams.get('async') === '1') {
      const prepared = await prepareLocalAsyncSource(source);
      const id = randomUUID();
      await writeLocalJob({ id, status: 'queued', updatedAt: Date.now() });
      void runLocalJob(id, prepared);
      return NextResponse.json({ id, status: 'queued' }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!backend) return NextResponse.json(await analyzeWithGemini(source));
    const health = await requestJson(`${backend}/health`) as { asyncJobs?: boolean };
    if (health.asyncJobs) {
      const created = await requestJson(`${backend}/jobs/analyze`, { method: 'POST', body: source }) as { jobId?: string };
      if (!created.jobId) throw new Error('El motor no devolvió un jobId.');
      const deadline = Date.now() + 25 * 60 * 1000;
      while (Date.now() < deadline) {
        await sleep(2200);
        const job = await requestJson(`${backend}/jobs/${encodeURIComponent(created.jobId)}`) as { status?: string; error?: string; result?: { report?: unknown } };
        if (job.status === 'COMPLETED') { if (!job.result?.report) throw new Error('El análisis terminó sin reporte.'); return NextResponse.json(normalizeReport(job.result.report)); }
        if (job.status === 'FAILED') throw new Error(job.error || 'El motor detuvo el análisis.');
      }
      throw new Error('El análisis superó el tiempo máximo de espera (25 min).');
    }
    const legacy = await requestJson(`${backend}/analyze`, { method: 'POST', body: source }) as { report?: unknown };
    if (!legacy.report) throw new Error('El motor no devolvió reporte.');
    return NextResponse.json(normalizeReport(legacy.report));
  } catch (error) {
    console.error('Fight AI web analysis error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar el análisis.' }, { status: 502 });
  }
}
