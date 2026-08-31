import { AttributeValue, DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type UploadedAnalysisRequest = {
  fileName?: string; fileUri?: string; s3Key?: string; mimeType?: string; language?: string; sport?: string; stance?: string;
  glove_color?: string; top_color?: string; relative_height?: string; build?: string; fighter_notes?: string;
  anchor_x?: string; anchor_y?: string; anchor_size?: string; anchor_time?: string;
  analysis_focus?: string; custom_focus?: string;
};

type ReportPayload = {
  mode: 'real'; provider: 'Gemini'; usedInReport: true; summary: string;
  strengths: string[]; priorities: string[]; opponent: string[]; plan: string[]; drills: string[];
  evidence: { time: string; title: string; observation: string; correction: string }[];
  timings: { preprocessing_ms: number; gemini_processing_ms: number; analysis_ms: number; total_ms: number; clip_count: number };
};
type AnalysisJob = {
  id: string; status: 'queued' | 'downloading' | 'converting' | 'uploading' | 'preparing' | 'coaching' | 'complete' | 'failed'; updatedAt: number;
  payload: UploadedAnalysisRequest; report?: ReportPayload; error?: string; leaseExpiresAt?: number;
};
const region = process.env.AWS_REGION || 'sa-east-1';
const tableName = process.env.FIGHT_AI_JOBS_TABLE || '';
const bucket = process.env.FIGHT_AI_INGEST_BUCKET || '';
const dynamo = new DynamoDBClient({ region });
const s3 = new S3Client({ region });
const leaseMs = 12 * 60 * 1000;
const workerId = crypto.randomUUID();
let workerStarted = false;
let workerScanning = false;

function activeStatus(status: AnalysisJob['status']) {
  return status === 'queued' || status === 'downloading' || status === 'converting' || status === 'uploading' || status === 'preparing' || status === 'coaching';
}

function itemToJob(item: Record<string, AttributeValue> | undefined): AnalysisJob | null {
  if (!item?.jobId?.S || !item.status?.S || !item.payload?.S) return null;
  try {
    return {
      id: item.jobId.S,
      status: item.status.S as AnalysisJob['status'],
      updatedAt: Number(item.updatedAt?.N || 0),
      payload: JSON.parse(item.payload.S) as UploadedAnalysisRequest,
      report: item.report?.S ? JSON.parse(item.report.S) as ReportPayload : undefined,
      error: item.error?.S,
      leaseExpiresAt: item.leaseExpiresAt?.N ? Number(item.leaseExpiresAt.N) : undefined,
    };
  } catch { return null; }
}

async function getJob(id: string) {
  if (!tableName) throw new Error('La persistencia de análisis aún no está configurada.');
  const response = await dynamo.send(new GetItemCommand({ TableName: tableName, Key: { jobId: { S: id } }, ConsistentRead: true }));
  return itemToJob(response.Item);
}

async function updateJob(id: string, status: AnalysisJob['status'], extra: { report?: ReportPayload; error?: string; clearLease?: boolean } = {}) {
  if (!tableName) throw new Error('La persistencia de análisis aún no está configurada.');
  const names: Record<string, string> = { '#status': 'status' };
  const values: Record<string, AttributeValue> = {
    ':status': { S: status }, ':updatedAt': { N: String(Date.now()) },
  };
  const sets = ['#status = :status', 'updatedAt = :updatedAt'];
  if (extra.report) { values[':report'] = { S: JSON.stringify(extra.report) }; sets.push('report = :report'); }
  if (extra.error) { values[':error'] = { S: extra.error.slice(0, 1200) }; sets.push('error = :error'); }
  if (extra.clearLease) { values[':lease'] = { N: '0' }; sets.push('leaseExpiresAt = :lease'); }
  await dynamo.send(new UpdateItemCommand({ TableName: tableName, Key: { jobId: { S: id } }, UpdateExpression: `SET ${sets.join(', ')}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values }));
}

async function heartbeatJob(id: string) {
  if (!tableName) return;
  const now = Date.now();
  try {
    await dynamo.send(new UpdateItemCommand({
      TableName: tableName,
      Key: { jobId: { S: id } },
      UpdateExpression: 'SET updatedAt = :updatedAt, leaseExpiresAt = :lease',
      ConditionExpression: 'leaseOwner = :owner AND #status IN (:downloading, :converting, :uploading, :preparing, :coaching, :queued)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':updatedAt': { N: String(now) },
        ':lease': { N: String(now + leaseMs) },
        ':owner': { S: workerId },
        ':queued': { S: 'queued' },
        ':downloading': { S: 'downloading' },
        ':converting': { S: 'converting' },
        ':uploading': { S: 'uploading' },
        ':preparing': { S: 'preparing' },
        ':coaching': { S: 'coaching' },
      },
    }));
  } catch {
    // Lease changed or job completed; heartbeat should stop silently.
  }
}

async function deferProviderRetry(id: string, status: AnalysisJob['status'], message: string, delayMs = 45_000) {
  if (!tableName) return;
  const now = Date.now();
  await dynamo.send(new UpdateItemCommand({
    TableName: tableName,
    Key: { jobId: { S: id } },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, leaseExpiresAt = :lease, error = :error REMOVE leaseOwner',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':updatedAt': { N: String(now) },
      ':lease': { N: String(now + delayMs) },
      ':error': { S: message.slice(0, 1200) },
    },
  }));
}

async function forceRetryIfAbandoned(job: AnalysisJob) {
  if (!tableName || !activeStatus(job.status)) return job;
  const now = Date.now();
  if (now - job.updatedAt < 2 * 60 * 1000) return job;
  await dynamo.send(new UpdateItemCommand({
    TableName: tableName,
    Key: { jobId: { S: job.id } },
    UpdateExpression: 'SET #status = :queued, leaseExpiresAt = :zero, updatedAt = :now REMOVE leaseOwner',
    ConditionExpression: 'updatedAt = :previous AND #status IN (:queued, :downloading, :converting, :uploading, :preparing, :coaching)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':queued': { S: 'queued' },
      ':zero': { N: '0' },
      ':now': { N: String(now) },
      ':previous': { N: String(job.updatedAt) },
      ':downloading': { S: 'downloading' },
      ':converting': { S: 'converting' },
      ':uploading': { S: 'uploading' },
      ':preparing': { S: 'preparing' },
      ':coaching': { S: 'coaching' },
    },
  }));
  return { ...job, status: 'queued' as const, updatedAt: now, leaseExpiresAt: 0 };
}

function makeThreeMinuteClip(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-t', '180', '-map', '0:v:0?', '-map', '0:a?', '-c', 'copy', '-movflags', '+faststart', outputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('El recorte del round tardó demasiado.')); }, 90 * 1000);
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('FFmpeg no está disponible para preparar el round.')); });
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'No se pudo preparar los primeros 3 minutos.'));
    });
  });
}

async function uploadS3VideoToGemini(data: UploadedAnalysisRequest, apiKey: string, updateJob?: (status: AnalysisJob['status']) => void | Promise<void>) {
  const key = val(data, 's3Key');
  if (!key || !key.startsWith('uploads/') || !bucket) throw new Error('Referencia de video no válida.');
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body || !object.ContentLength) throw new Error('No se pudo recuperar el video cargado.');
  const inputPath = join(tmpdir(), `fight-ai-source-${crypto.randomUUID()}.mp4`);
  const clipPath = join(tmpdir(), `fight-ai-round-${crypto.randomUUID()}.mp4`);
  try {
    await updateJob?.('downloading');
    await pipeline(object.Body as Readable, createWriteStream(inputPath, { flags: 'wx' }));
    await updateJob?.('converting');
    await makeThreeMinuteClip(inputPath, clipPath);
    const clip = await stat(clipPath);
    if (!clip.size) throw new Error('El clip de 3 minutos quedó vacío.');
    const mimeType = 'video/mp4';
    await updateJob?.('uploading');
    const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
      method: 'POST', headers: { 'x-goog-api-key': apiKey, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(clip.size), 'X-Goog-Upload-Header-Content-Type': mimeType, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: { display_name: `round-3min-${val(data, 'fileName', key).slice(0, 160)}` } }), cache: 'no-store',
    });
    if (!start.ok) throw new Error(`Gemini no pudo iniciar la carga (${start.status}).`);
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('Gemini no devolvió URL de carga.');
    const body = Readable.toWeb(createReadStream(clipPath) as Readable);
    const uploaded = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Length': String(clip.size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body, cache: 'no-store', signal: AbortSignal.timeout(15 * 60 * 1000), duplex: 'half' } as RequestInit & { duplex: 'half' });
    if (!uploaded.ok) throw new Error(`Gemini no pudo cargar el video (${uploaded.status}).`);
    const info = await uploaded.json() as { file?: { name?: string; uri?: string } };
    if (!info.file?.name || !info.file.uri) throw new Error('Gemini no devolvió referencia del video.');
    return { fileName: info.file.name, fileUri: info.file.uri, mimeType };
  } finally {
    await Promise.all([unlink(inputPath).catch(() => undefined), unlink(clipPath).catch(() => undefined)]);
  }
}


type SignedSegment = { uri: string; offset: number; duration: number; size: number };

function makeClipRange(inputPath: string, outputPath: string, startSeconds: number, durationSeconds: number) {
  return new Promise<void>((resolve, reject) => {
    const args = ['-hide_banner', '-loglevel', 'error', '-y'];
    if (startSeconds > 0) args.push('-ss', String(startSeconds));
    args.push('-i', inputPath, '-t', String(durationSeconds), '-map', '0:v:0?', '-map', '0:a?', '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', outputPath);
    const encoder = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('La segmentación del round tardó demasiado.')); }, 90 * 1000);
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('FFmpeg no está disponible para segmentar el round.')); });
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'No se pudo segmentar el round.'));
    });
  });
}

async function prepareSignedSegments(data: UploadedAnalysisRequest, updateJob?: (status: AnalysisJob['status']) => void | Promise<void>) {
  const key = val(data, 's3Key');
  if (!key || !key.startsWith('uploads/') || !bucket) throw new Error('Referencia de video no válida.');
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body || !object.ContentLength) throw new Error('No se pudo recuperar el video cargado.');
  const inputPath = join(tmpdir(), 'fight-ai-source-' + crypto.randomUUID() + '.mp4');
  const clipPath = join(tmpdir(), 'fight-ai-round-' + crypto.randomUUID() + '.mp4');
  const segmentPaths: string[] = [];
  try {
    await updateJob?.('downloading');
    await pipeline(object.Body as Readable, createWriteStream(inputPath, { flags: 'wx' }));
    await updateJob?.('converting');
    await makeThreeMinuteClip(inputPath, clipPath);
    const clip = await stat(clipPath);
    if (!clip.size) throw new Error('El clip de 3 minutos quedó vacío.');

    // Keep a three-minute HEVC round in one Gemini batch whenever possible.
    // 55 MB made a 275 MB round become five segments (two serial batches),
    // which is why otherwise healthy mobile jobs exceeded nine minutes.
    const targetBytes = 90 * 1024 * 1024;
    const maxBytes = 95 * 1024 * 1024;
    const count = Math.max(1, Math.min(8, Math.ceil(clip.size / targetBytes)));
    if (clip.size / count > maxBytes) throw new Error('El video supera la ruta rápida sin recodificar.');

    const duration = 180 / count;
    const local: { path: string; offset: number; duration: number; size: number }[] = [];
    if (count === 1) {
      local.push({ path: clipPath, offset: 0, duration: 180, size: clip.size });
    } else {
      for (let i = 0; i < count; i++) {
        const offset = i * duration;
        const pieceDuration = Math.min(duration, 180 - offset);
        const path = join(tmpdir(), 'fight-ai-segment-' + crypto.randomUUID() + '.mp4');
        segmentPaths.push(path);
        await makeClipRange(clipPath, path, offset, pieceDuration);
        const info = await stat(path);
        if (!info.size || info.size > maxBytes) throw new Error('Un segmento del video sigue siendo demasiado pesado.');
        local.push({ path, offset, duration: pieceDuration, size: info.size });
      }
    }

    await updateJob?.('uploading');
    const prefix = 'uploads/analysis-proxy/' + crypto.randomUUID();
    const result: SignedSegment[] = [];
    for (let i = 0; i < local.length; i++) {
      const item = local[i];
      const proxyKey = prefix + '/segment-' + String(i + 1).padStart(2, '0') + '.mp4';
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: proxyKey, Body: createReadStream(item.path), ContentType: 'video/mp4', ServerSideEncryption: 'AES256' }));
      const uri = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: proxyKey }), { expiresIn: 1800 });
      result.push({ uri, offset: item.offset, duration: item.duration, size: item.size });
    }
    return result;
  } finally {
    await Promise.all([unlink(inputPath).catch(() => undefined), unlink(clipPath).catch(() => undefined), ...segmentPaths.map(path => unlink(path).catch(() => undefined))]);
  }
}

function absoluteTime(local: string, offsetSeconds: number) {
  const parts = local.split(':').map(Number);
  const seconds = parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : 0;
  const total = Math.max(0, Math.round(seconds + offsetSeconds));
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function buildSegmentPrompt(data: UploadedAnalysisRequest, index: number, count: number, offset: number, duration: number) {
  const descriptors = [
    val(data,'glove_color') && 'guantes ' + val(data,'glove_color'),
    val(data,'top_color') && 'ropa/polera ' + val(data,'top_color'),
    val(data,'relative_height') && 'altura relativa ' + val(data,'relative_height'),
    val(data,'build') && 'contextura ' + val(data,'build'),
    val(data,'fighter_notes'),
  ].filter(Boolean).join('; ');
  const languageInstruction = val(data,'language','es') === 'en' ? 'Write the entire report in English.' : 'Escribe todo el reporte en español natural.';
  return 'Actúa como entrenador de boxeo/kickboxing de alto nivel. ' + languageInstruction +
    '\nEste es el segmento ' + (index + 1) + ' de ' + count + ' del mismo round, aproximadamente desde ' + absoluteTime('00:00', offset) + ' hasta ' + absoluteTime('00:00', offset + duration) + '.' +
    '\nPeleador objetivo: ' + (descriptors || 'peleador identificado por el usuario') + '. Guardia: ' + val(data,'stance','unknown') + '. Disciplina: ' + val(data,'sport','boxing') + '.' +
    '\nFoco: ' + val(data,'analysis_focus','technique,weaknesses,strategy') + '. ' + val(data,'custom_focus','') +
    '\nNo cambies de peleador si la identidad se vuelve dudosa. No inventes conteos, porcentajes, velocidad ni precisión.' +
    '\nBusca patrones visibles en guardia, base, entradas, salidas, defensa tras combinar, distancia, timing, ángulos, pivotes, footwork, golpes, ritmo, presión y lectura del rival.' +
    '\nConecta observación → consecuencia → corrección → drill. Usa 2–5 evidencias con timestamps MM:SS LOCALES de este segmento.' +
    '\nsummary debe ser breve (1–2 frases) y específico para este segmento. Devuelve exclusivamente JSON válido con summary, strengths, priorities, opponent, plan, drills y evidence.';
}

function mergeSegmentReports(parts: Record<string, unknown>[], offsets: number[]) {
  const stringList = (value: unknown) => Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()) as string[] : [];
  const unique = (values: string[], limit: number) => Array.from(new Set(values.map(x => x.trim()).filter(Boolean))).slice(0, limit);
  const evidence: { time: string; title: string; observation: string; correction: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const items = Array.isArray(parts[i].evidence) ? parts[i].evidence as unknown[] : [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const local = typeof item.time === 'string' ? item.time : '00:00';
      const observation = typeof item.observation === 'string' ? item.observation : '';
      if (!observation) continue;
      evidence.push({
        time: absoluteTime(local, offsets[i] || 0),
        title: typeof item.title === 'string' ? item.title : 'Evidencia',
        observation,
        correction: typeof item.correction === 'string' ? item.correction : '',
      });
    }
  }
  evidence.sort((a,b) => a.time.localeCompare(b.time));
  return {
    summary: parts.map(x => typeof x.summary === 'string' ? x.summary.trim() : '').filter(Boolean).slice(0, 3).join(' '),
    strengths: unique(parts.flatMap(x => stringList(x.strengths)), 5),
    priorities: unique(parts.flatMap(x => stringList(x.priorities)), 3),
    opponent: unique(parts.flatMap(x => stringList(x.opponent)), 5),
    plan: unique(parts.flatMap(x => stringList(x.plan)), 6),
    drills: unique(parts.flatMap(x => stringList(x.drills)), 6),
    evidence: evidence.slice(0, 8),
  };
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

function cleanGeminiJson(text: string) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()) as Record<string, unknown>;
}

function interactionOutputText(raw: unknown) {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.steps)) return '';
  const chunks: string[] = [];
  for (const step of data.steps) {
    if (!step || typeof step !== 'object' || !Array.isArray((step as Record<string, unknown>).content)) continue;
    for (const item of (step as { content: unknown[] }).content) {
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string') chunks.push((item as { text: string }).text);
    }
  }
  return chunks.join('').trim();
}

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string, externalUrl = false) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = externalUrl
    ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
    : Array.from(new Set([configured || '', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.6-flash'].filter(Boolean)));
  let lastStatus = 0; let retryAfter = 0;
  for (const model of candidates) {
    const maxAttempts = externalUrl ? 2 : 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [{ type: 'video', uri: fileUri, mime_type: mimeType }, { type: 'text', text: prompt }], response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema }, store: false }), cache: 'no-store',
          signal: AbortSignal.timeout(externalUrl ? 4 * 60 * 1000 : 8 * 60 * 1000),
        });
      } catch {
        lastStatus = 0;
        if (attempt + 1 < maxAttempts) { await sleep(5000 * (attempt + 1)); continue; }
        break;
      }
      lastStatus = response.status; retryAfter = Number(response.headers.get('retry-after') || 0);
      const body = await response.text();
      if (response.ok) {
        const text = interactionOutputText(JSON.parse(body) as unknown);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }
      if ((response.status === 429 || response.status === 503) && attempt + 1 < maxAttempts) {
        await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  if (lastStatus === 429 || lastStatus === 503 || lastStatus === 0) {
    throw new Error('GEMINI_BUSY:Gemini está temporalmente ocupado. El job seguirá intentando automáticamente sin volver a subir el video.');
  }
  throw new Error(`Gemini rechazó el análisis (${lastStatus}).`);
}

function val(data: UploadedAnalysisRequest, key: keyof UploadedAnalysisRequest, fallback = '') {
  const value = data[key]; return typeof value === 'string' ? value.trim() : fallback;
}

async function completeAnalysis(data: UploadedAnalysisRequest, updateJob?: (status: AnalysisJob['status']) => void | Promise<void>): Promise<ReportPayload> {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini no está configurado en el servidor.');
    let fileName = val(data, 'fileName'); let fileUri = val(data, 'fileUri'); let mimeType = val(data, 'mimeType', 'video/mp4');
    if (!fileName || !fileUri) {
      const preprocessingStartedAt = Date.now();
      const segments = await prepareSignedSegments(data, updateJob);
      const preprocessingMs = Date.now() - preprocessingStartedAt;
      if (!segments.length) throw new Error('No se pudo preparar el round para análisis rápido.');
      await updateJob?.('coaching');
      const analysisStartedAt = Date.now();
      const parts: Record<string, unknown>[] = [];
      for (let offset = 0; offset < segments.length; offset += 3) {
        const batch = segments.slice(offset, offset + 3);
        const analyzed = await Promise.all(batch.map((segment, localIndex) =>
          generateCoachJson(
            apiKey,
            buildSegmentPrompt(data, offset + localIndex, segments.length, segment.offset, segment.duration),
            segment.uri,
            'video/mp4',
            true,
          )
        ));
        parts.push(...analyzed);
      }
      const merged = mergeSegmentReports(parts, segments.map(segment => segment.offset));
      const analysisMs = Date.now() - analysisStartedAt;
      return {
        mode: 'real', provider: 'Gemini', usedInReport: true,
        summary: merged.summary || 'Análisis completado con Gemini.',
        strengths: merged.strengths, priorities: merged.priorities.slice(0, 3), opponent: merged.opponent,
        plan: merged.plan, drills: merged.drills, evidence: merged.evidence,
        timings: {
          preprocessing_ms: preprocessingMs,
          gemini_processing_ms: analysisMs,
          analysis_ms: analysisMs,
          total_ms: Date.now() - startedAt,
          clip_count: segments.length,
        },
      };
    }
    if (!fileName || !fileUri) throw new Error('Falta la referencia del video cargado.');
    if (!fileName.startsWith('files/') || !/^https:\/\/generativelanguage\.googleapis\.com\//.test(fileUri)) {
      throw new Error('Referencia de video no válida.');
    }

    const processingStartedAt = Date.now();
    await updateJob?.('preparing');
    let state = 'PROCESSING';
    const deadline = Date.now() + 8 * 60 * 1000;
    while (state !== 'ACTIVE' && Date.now() < deadline) {
      const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, { headers: { 'x-goog-api-key': apiKey }, cache: 'no-store' });
      if (!status.ok) throw new Error(`No se pudo consultar el estado del video en Gemini (${status.status}).`);
      state = (await status.json() as { state?: string }).state || 'PROCESSING';
      if (state === 'FAILED') throw new Error('Gemini no pudo preparar el video.');
      if (state !== 'ACTIVE') await sleep(1800);
    }
    if (state !== 'ACTIVE') throw new Error('Gemini tardó demasiado en preparar el video.');

    const descriptors = [
      val(data,'glove_color') && `guantes ${val(data,'glove_color')}`,
      val(data,'top_color') && `ropa/polera ${val(data,'top_color')}`,
      val(data,'relative_height') && `altura relativa ${val(data,'relative_height')}`,
      val(data,'build') && `contextura ${val(data,'build')}`,
      val(data,'fighter_notes'),
    ].filter(Boolean).join('; ');
    const anchorTime = Number(val(data, 'anchor_time', '0')) || 0;
    const anchor = val(data,'anchor_x') && val(data,'anchor_y')
      ? `El usuario marcó al peleador en t=${anchorTime.toFixed(1)}s cerca de x=${val(data,'anchor_x')}%, y=${val(data,'anchor_y')}%, con círculo aproximado ${val(data,'anchor_size','24')}% del ancho. Usa ESE momento como ancla visual y sigue la misma identidad por continuidad temporal.`
      : 'Mantén la identidad usando las características visibles y continuidad temporal.';
    const languageInstruction = val(data,'language','es') === 'en' ? 'Write the entire report in English.' : 'Escribe todo el reporte en español natural.';

    const prompt = `Actúa como un entrenador de boxeo/kickboxing de alto nivel haciendo una revisión clínica post-sparring. ${languageInstruction}

VIDEO Y OBJETIVO:
- Disciplina: ${val(data,'sport','boxing')}.
- Guardia declarada del atleta: ${val(data,'stance','unknown')}.
- Peleador objetivo: ${descriptors || 'peleador seleccionado visualmente por el usuario'}.
- ${anchor}
- Si la identidad se vuelve dudosa, NO cambies de peleador silenciosamente: usa solo momentos en que estés seguro.

FOCO PEDIDO POR EL ATLETA:
- Áreas: ${val(data,'analysis_focus','technique,weaknesses,strategy')}.
- Objetivo personalizado: ${val(data,'custom_focus','ninguno adicional')}.

ESTÁNDAR DE COACHING:
1. No hagas comentarios genéricos. Busca patrones que se repitan y explica el contexto exacto.
2. Para cada prioridad conecta QUÉ sucede visualmente → POR QUÉ probablemente sucede → QUÉ consecuencia técnica/táctica produce → CÓMO corregirlo.
3. Distingue hechos visibles de hipótesis. No inventes conteos, porcentajes, velocidad, precisión ni estadísticas.
4. Revisa guardia/recuperación, base/balance, transferencia de peso, entradas, salidas, head movement, defensa después de combinaciones, distancia, timing, ángulos/pivotes, footwork, selección de golpes, ritmo, presión, reacción al jab, trabajo al cuerpo y decisiones bajo presión cuando sean visibles.
5. Lee al rival: rango, reacciones recurrentes, patrones defensivos/ofensivos, qué explota del atleta y qué vulnerabilidades ofrece. Convierte esa lectura en plan de revancha.
6. Prioriza SOLO 3 correcciones de mayor impacto. Deben ser específicas y desarrolladas.
7. Explica cómo explotar estratégicamente cada fortaleza.
8. Cada drill debe corresponder a una prioridad e incluir estructura práctica y objetivo técnico.
9. evidence usa timestamps MM:SS realmente visibles; 4–8 momentos distribuidos cuando el video lo permita. observation dice qué se ve y correction exactamente qué hacer distinto.
10. summary es diagnóstico de 4–7 frases: estilo, limitación principal, explotación del rival, fortaleza útil y cambio #1 para la próxima sesión.

Devuelve exclusivamente JSON válido con summary, strengths, priorities, opponent, plan, drills y evidence.`;

    const geminiProcessingMs = Date.now() - processingStartedAt;
    const analysisStartedAt = Date.now();
    await updateJob?.('coaching');
    const parsed = await generateCoachJson(apiKey, prompt, fileUri, mimeType);
    const list = (value: unknown) => Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()) as string[] : [];
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter(x => x && typeof x === 'object').map(x => {
      const item = x as Record<string, unknown>;
      return { time: typeof item.time === 'string' ? item.time : '00:00', title: typeof item.title === 'string' ? item.title : 'Evidencia', observation: typeof item.observation === 'string' ? item.observation : '', correction: typeof item.correction === 'string' ? item.correction : '' };
    }).filter(x => /^\d{1,2}:\d{2}$/.test(x.time) && x.observation) : [];

    return {
      mode: 'real', provider: 'Gemini', usedInReport: true,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado con Gemini.',
      strengths: list(parsed.strengths), priorities: list(parsed.priorities).slice(0, 3), opponent: list(parsed.opponent),
      plan: list(parsed.plan), drills: list(parsed.drills), evidence,
      timings: {
        preprocessing_ms: 0,
        gemini_processing_ms: geminiProcessingMs,
        analysis_ms: Date.now() - analysisStartedAt,
        total_ms: Date.now() - startedAt,
        clip_count: 1,
      },
    };
}

async function claimAndRun(job: AnalysisJob) {
  if (!activeStatus(job.status) || !tableName) return;
  const now = Date.now();
  try {
    await dynamo.send(new UpdateItemCommand({
      TableName: tableName, Key: { jobId: { S: job.id } },
      UpdateExpression: 'SET leaseOwner = :owner, leaseExpiresAt = :lease, updatedAt = :updatedAt',
      ConditionExpression: '#status IN (:queued, :downloading, :converting, :uploading, :preparing, :coaching) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':owner': { S: workerId }, ':lease': { N: String(now + leaseMs) }, ':updatedAt': { N: String(now) }, ':now': { N: String(now) }, ':queued': { S: 'queued' }, ':downloading': { S: 'downloading' }, ':converting': { S: 'converting' }, ':uploading': { S: 'uploading' }, ':preparing': { S: 'preparing' }, ':coaching': { S: 'coaching' } },
    }));
  } catch { return; }
  const heartbeat = setInterval(() => { void heartbeatJob(job.id); }, 30_000);
  void completeAnalysis(job.payload, async (status) => updateJob(job.id, status)).then(
    (report) => {
      clearInterval(heartbeat);
      return updateJob(job.id, 'complete', { report, clearLease: true });
    },
    (error) => {
      clearInterval(heartbeat);
      console.error('Fight AI uploaded-file async analysis error', error);
      const message = error instanceof Error ? error.message : 'No se pudo completar el análisis.';
      if (message.startsWith('GEMINI_BUSY:')) {
        return deferProviderRetry(job.id, 'coaching', message.replace(/^GEMINI_BUSY:/, ''), 45_000);
      }
      return updateJob(job.id, 'failed', { error: message, clearLease: true });
    },
  );
}

async function runAnalysisWorker() {
  if (!tableName || workerScanning) return;
  workerScanning = true;
  try {
    const now = Date.now();
    const response = await dynamo.send(new ScanCommand({
      TableName: tableName,
      Limit: 8,
      FilterExpression: '#status IN (:queued, :downloading, :converting, :uploading, :preparing, :coaching) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':now': { N: String(now) }, ':queued': { S: 'queued' }, ':downloading': { S: 'downloading' }, ':converting': { S: 'converting' }, ':uploading': { S: 'uploading' }, ':preparing': { S: 'preparing' }, ':coaching': { S: 'coaching' } },
    }));
    for (const item of response.Items || []) {
      const job = itemToJob(item);
      if (job) await claimAndRun(job);
    }
  } catch (error) {
    console.error('Fight AI durable worker scan error', error);
  } finally {
    workerScanning = false;
  }
}

function startDurableAnalysisWorker() {
  if (workerStarted || !tableName) return;
  workerStarted = true;
  void runAnalysisWorker();
  setInterval(() => { void runAnalysisWorker(); }, 5000);
}

(globalThis as typeof globalThis & { __fightAiStartDurableWorker?: () => void }).__fightAiStartDurableWorker = startDurableAnalysisWorker;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json() as UploadedAnalysisRequest;
    if (new URL(req.url).searchParams.get('async') !== '1') return NextResponse.json(await completeAnalysis(data));
    if (!tableName) return NextResponse.json({ error: 'La persistencia de análisis aún no está configurada.' }, { status: 503 });
    const id = typeof (data as { jobId?: unknown }).jobId === 'string' ? (data as { jobId: string }).jobId : crypto.randomUUID();
    const now = Date.now();
    const job: AnalysisJob = { id, status: 'queued', updatedAt: now, payload: data, leaseExpiresAt: 0 };
    try {
      await dynamo.send(new PutItemCommand({ TableName: tableName, Item: {
        jobId: { S: id }, status: { S: job.status }, payload: { S: JSON.stringify(data) }, updatedAt: { N: String(now) }, leaseExpiresAt: { N: '0' }, expiresAt: { N: String(Math.floor(now / 1000) + 172800) },
      }, ConditionExpression: 'attribute_not_exists(jobId)' }));
    } catch (error) {
      const existing = await getJob(id);
      if (!existing) throw error;
      const retryRequested = new URL(req.url).searchParams.get('retry') === '1';
      let reusable = existing;
      if (retryRequested) {
        try { reusable = await forceRetryIfAbandoned(existing); } catch { reusable = (await getJob(id)) || existing; }
      }
      // Start immediately as a safe fallback; the boot worker also recovers leases.
      await claimAndRun(reusable);
      return NextResponse.json({ id, status: reusable.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }
    await claimAndRun(job);
    return NextResponse.json({ id, status: job.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Fight AI uploaded-file analysis error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar el análisis.' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Falta el identificador del trabajo.' }, { status: 400 });
  try {
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: 'El trabajo no está disponible. Puedes reintentar sin volver a subir el video.' }, { status: 404 });
    if (job.status === 'complete' && job.report) return NextResponse.json({ status: job.status, report: job.report }, { headers: { 'Cache-Control': 'no-store' } });
    if (job.status === 'failed') return NextResponse.json({ status: job.status, error: job.error || 'No se pudo completar el análisis.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    await claimAndRun(job);
    return NextResponse.json({ status: job.status, updatedAt: job.updatedAt }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Fight AI job lookup error', error);
    return NextResponse.json({ error: 'No se pudo recuperar el trabajo de análisis.' }, { status: 502 });
  }
}
