import { AttributeValue, DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, unlink } from 'node:fs/promises';
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
  payload: UploadedAnalysisRequest; report?: ReportPayload; error?: string; leaseExpiresAt?: number; retryCount?: number;
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
      retryCount: item.retryCount?.N ? Number(item.retryCount.N) : 0,
    };
  } catch { return null; }
}

async function getJob(id: string) {
  if (!tableName) throw new Error('La persistencia de análisis aún no está configurada.');
  const response = await dynamo.send(new GetItemCommand({ TableName: tableName, Key: { jobId: { S: id } }, ConsistentRead: true }));
  return itemToJob(response.Item);
}

async function updateJob(id: string, status: AnalysisJob['status'], extra: { report?: ReportPayload; error?: string; clearLease?: boolean; payload?: UploadedAnalysisRequest } = {}) {
  if (!tableName) throw new Error('La persistencia de análisis aún no está configurada.');
  const names: Record<string, string> = { '#status': 'status' };
  const values: Record<string, AttributeValue> = {
    ':status': { S: status }, ':updatedAt': { N: String(Date.now()) },
  };
  const sets = ['#status = :status', 'updatedAt = :updatedAt'];
  if (extra.report) { values[':report'] = { S: JSON.stringify(extra.report) }; sets.push('report = :report'); }
  if (extra.payload) { values[':payload'] = { S: JSON.stringify(extra.payload) }; sets.push('payload = :payload'); }
  if (extra.error) { names['#error'] = 'error'; values[':error'] = { S: extra.error.slice(0, 1200) }; sets.push('#error = :error'); }
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
  const stored = await dynamo.send(new GetItemCommand({
    TableName: tableName,
    Key: { jobId: { S: id } },
    ProjectionExpression: 'retryCount',
    ConsistentRead: true,
  }));
  const retryCount = Number(stored.Item?.retryCount?.N || 0);
  if (retryCount >= 5) {
    await updateJob(id, 'failed', {
      error: 'Gemini no estuvo disponible después de varios intentos. Reintenta más tarde sin volver a subir el video.',
      clearLease: true,
    });
    return;
  }
  const nextRetryCount = retryCount + 1;
  const retryDelay = Math.min(15 * 60_000, Math.max(delayMs, 60_000 * (2 ** retryCount)));
  await dynamo.send(new UpdateItemCommand({
    TableName: tableName,
    Key: { jobId: { S: id } },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, leaseExpiresAt = :lease, #error = :error, retryCount = :retryCount REMOVE leaseOwner',
    ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
    ExpressionAttributeValues: {
      ':status': { S: status },
      ':updatedAt': { N: String(now) },
      ':lease': { N: String(now + retryDelay) },
      ':error': { S: message.slice(0, 1200) },
      ':retryCount': { N: String(nextRetryCount) },
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

/**
 * Gemini Files rate-limits repeated large HEVC uploads.  Preserve the fast
 * stream-copy path above, but when that clip is still too large, make one
 * deliberately small, browser-compatible fallback for the analysis worker.
 * The private source in S3 is never modified.
 */
function makeCompactCompatibleClip(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-t', '180',
      '-map', '0:v:0?', '-map', '0:a?', '-vf', 'scale=-2:540',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', outputPath,
    ];
    const encoder = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('La conversión compatible del round tardó demasiado.')); }, 4 * 60 * 1000);
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('FFmpeg no está disponible para convertir el round.')); });
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'No se pudo convertir el round a MP4 compatible.'));
    });
  });
}

/**
 * Inline Interactions has a much smaller request budget than Gemini Files.
 * When Files is saturated, make one deliberately small 3-minute coaching clip
 * instead of splitting the round into many sequential model calls. 480p at a
 * bounded bitrate preserves enough motion/guard/footwork detail for the
 * fallback while keeping the raw MP4 around 11-12 MB before base64 expansion.
 */
function makeInlineCompatibleClip(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-t', '180',
      '-map', '0:v:0?', '-map', '0:a?', '-vf', 'scale=-2:480',
      '-c:v', 'libx264', '-preset', 'veryfast',
      '-b:v', '440k', '-maxrate', '500k', '-bufsize', '1000k', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', outputPath,
    ];
    const encoder = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('La conversión inline del round tardó demasiado.')); }, 4 * 60 * 1000);
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('FFmpeg no está disponible para convertir el fallback inline.')); });
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'No se pudo convertir el fallback inline.'));
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


type GeminiPreparedSegment = { fileName: string; fileUri: string; offset: number; duration: number; size: number };

async function uploadLocalSegmentToGemini(apiKey: string, path: string, displayName: string, size: number) {
  const mimeType = 'video/mp4';
  let start: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(size),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName.slice(0, 160) } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    if (start.ok) break;
    if (start.status !== 429 && start.status !== 503) throw new Error(`Gemini no pudo iniciar un segmento (${start.status}).`);
    if (attempt < 3) await sleep(Math.max(Number(start.headers.get('retry-after') || 0) * 1000, 15_000 * (attempt + 1)));
  }
  if (!start?.ok) throw new Error('GEMINI_BUSY:Gemini está temporalmente ocupado; el análisis se reintentará automáticamente.');
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini no devolvió URL de carga para un segmento.');

  const body = Readable.toWeb(createReadStream(path) as Readable);
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(4 * 60 * 1000),
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
    if (!uploaded.ok) {
      if (uploaded.status === 429 || uploaded.status === 503) throw new Error('GEMINI_BUSY:Gemini está temporalmente ocupado; el análisis se reintentará automáticamente.');
      throw new Error(`Gemini no pudo cargar un segmento (${uploaded.status}).`);
    }
  const info = await uploaded.json() as { file?: { name?: string; uri?: string; state?: string } };
  const fileName = info.file?.name || '';
  const fileUri = info.file?.uri || '';
  if (!fileName || !fileUri) throw new Error('Gemini no devolvió referencia del segmento.');
  return { fileName, fileUri, state: info.file?.state || 'PROCESSING' };
}

async function waitGeminiFileActive(apiKey: string, fileName: string, initialState = 'PROCESSING') {
  let state = initialState;
  const deadline = Date.now() + 3 * 60 * 1000;
  while (state !== 'ACTIVE' && Date.now() < deadline) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
      headers: { 'x-goog-api-key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`No se pudo consultar un segmento en Gemini (${response.status}).`);
    state = (await response.json() as { state?: string }).state || 'PROCESSING';
    if (state === 'FAILED') throw new Error('Gemini no pudo preparar un segmento.');
    if (state !== 'ACTIVE') await sleep(1500);
  }
  if (state !== 'ACTIVE') throw new Error('Gemini tardó demasiado en preparar un segmento.');
}

async function prepareGeminiSegments(
  data: UploadedAnalysisRequest,
  apiKey: string,
  updateJob?: (status: AnalysisJob['status']) => void | Promise<void>,
) {
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
    let clip = await stat(clipPath);
    if (!clip.size) throw new Error('El clip de 3 minutos quedó vacío.');

    // Stream copy stays the normal path. A large phone HEVC round is the
    // exception: compact it once instead of creating 8-12 Gemini uploads that
    // contend for provider capacity and leave the user waiting indefinitely.
    const compactThreshold = 45 * 1024 * 1024;
    if (clip.size > compactThreshold) {
      await unlink(clipPath);
      await makeCompactCompatibleClip(inputPath, clipPath);
      clip = await stat(clipPath);
      if (!clip.size) throw new Error('El MP4 compatible quedó vacío.');
    }

    const targetBytes = 45 * 1024 * 1024;
    const maxBytes = 55 * 1024 * 1024;
    const count = Math.max(1, Math.min(2, Math.ceil(clip.size / targetBytes)));
    if (clip.size / count > maxBytes) throw new Error('El video supera la ruta segmentada sin recodificar.');

    const duration = 180 / count;
    const local: { path: string; offset: number; duration: number; size: number }[] = [];
    if (count === 1) {
      local.push({ path: clipPath, offset: 0, duration: 180, size: clip.size });
    } else {
      for (let i = 0; i < count; i++) {
        const offset = i * duration;
        const pieceDuration = Math.min(duration, 180 - offset);
        const path = join(tmpdir(), 'fight-ai-gemini-segment-' + crypto.randomUUID() + '.mp4');
        segmentPaths.push(path);
        await makeClipRange(clipPath, path, offset, pieceDuration);
        const info = await stat(path);
        if (!info.size || info.size > maxBytes) throw new Error('Un segmento sigue siendo demasiado pesado.');
        local.push({ path, offset, duration: pieceDuration, size: info.size });
      }
    }

    await updateJob?.('uploading');
    const uploaded = await mapWithConcurrency(local, 1, async (segment, index) => {
      const ref = await uploadLocalSegmentToGemini(
        apiKey,
        segment.path,
        `round-part-${index + 1}-${val(data, 'fileName', key)}`,
        segment.size,
      );
      return { ...ref, offset: segment.offset, duration: segment.duration, size: segment.size };
    });

    await updateJob?.('preparing');
    await mapWithConcurrency(uploaded, 1, async (segment) => {
      await waitGeminiFileActive(apiKey, segment.fileName, segment.state);
      return true;
    });

    return uploaded.map(({ fileName, fileUri, offset, duration, size }) => ({ fileName, fileUri, offset, duration, size })) as GeminiPreparedSegment[];
  } finally {
    await Promise.all([
      unlink(inputPath).catch(() => undefined),
      unlink(clipPath).catch(() => undefined),
      ...segmentPaths.map(path => unlink(path).catch(() => undefined)),
    ]);
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const run = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}


type InlineSegment = { path: string; offset: number; duration: number; size: number };

async function prepareInlineSegments(
  data: UploadedAnalysisRequest,
  updateJob?: (status: AnalysisJob['status']) => void | Promise<void>,
) {
  const key = val(data, 's3Key');
  if (!key || !key.startsWith('uploads/') || !bucket) throw new Error('Referencia de video no válida.');
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body || !object.ContentLength) throw new Error('No se pudo recuperar el video cargado.');

  const inputPath = join(tmpdir(), 'fight-ai-inline-source-' + crypto.randomUUID() + '.mp4');
  const clipPath = join(tmpdir(), 'fight-ai-inline-round-' + crypto.randomUUID() + '.mp4');
  const segmentPaths: string[] = [];
  await updateJob?.('downloading');
  await pipeline(object.Body as Readable, createWriteStream(inputPath, { flags: 'wx' }));

  try {
    await updateJob?.('converting');
    await makeThreeMinuteClip(inputPath, clipPath);
    let clip = await stat(clipPath);
    if (!clip.size) throw new Error('El clip de 3 minutos quedó vacío.');

    // Inline is only a Files-capacity fallback. Force a single bounded-size
    // three-minute clip whenever stream-copy is too large so we avoid N
    // sequential model calls (the source of ~10 minute real-device waits).
    const targetBytes = 11 * 1024 * 1024;
    const maxBytes = 13 * 1024 * 1024;
    if (clip.size > targetBytes) {
      await unlink(clipPath);
      await makeInlineCompatibleClip(inputPath, clipPath);
      clip = await stat(clipPath);
      if (!clip.size) throw new Error('El MP4 inline quedó vacío.');
    }

    // Normally this is now exactly one segment. Keep a two-part emergency
    // guard only for encoder/container overhead unexpectedly above the limit.
    const count = Math.max(1, Math.min(2, Math.ceil(clip.size / targetBytes)));
    if (clip.size / count > maxBytes) throw new Error('El video supera el límite seguro de la ruta inline.');

    const duration = 180 / count;
    const segments: InlineSegment[] = [];
    if (count === 1) {
      segments.push({ path: clipPath, offset: 0, duration: 180, size: clip.size });
    } else {
      for (let i = 0; i < count; i++) {
        const offset = i * duration;
        const pieceDuration = Math.min(duration, 180 - offset);
        const path = join(tmpdir(), 'fight-ai-inline-part-' + crypto.randomUUID() + '.mp4');
        segmentPaths.push(path);
        await makeClipRange(clipPath, path, offset, pieceDuration);
        const info = await stat(path);
        if (!info.size || info.size > maxBytes) throw new Error('Un segmento inline sigue siendo demasiado pesado.');
        segments.push({ path, offset, duration: pieceDuration, size: info.size });
      }
    }
    return {
      segments,
      cleanup: async () => {
        await Promise.all([
          unlink(inputPath).catch(() => undefined),
          unlink(clipPath).catch(() => undefined),
          ...segmentPaths.map(path => unlink(path).catch(() => undefined)),
        ]);
      },
    };
  } catch (error) {
    await Promise.all([
      unlink(inputPath).catch(() => undefined),
      unlink(clipPath).catch(() => undefined),
      ...segmentPaths.map(path => unlink(path).catch(() => undefined)),
    ]);
    throw error;
  }
}

async function generateCoachJsonInline(apiKey: string, prompt: string, path: string) {
  const bytes = await readFile(path);
  // Leave room for base64 expansion + prompt/schema under Gemini's inline
  // request guidance. If a future regression produces a larger segment, fail
  // before sending an oversized request to the provider.
  const inlineRawLimit = 13 * 1024 * 1024;
  if (bytes.length > inlineRawLimit) {
    throw new Error('El segmento inline supera el límite seguro antes de enviarlo a Gemini.');
  }
  const encoded = bytes.toString('base64');
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = Array.from(new Set([
    configured || '',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ].filter(Boolean)));

  let lastStatus = 0;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input: [
              { type: 'text', text: prompt },
              { type: 'video', data: encoded, mime_type: 'video/mp4' },
            ],
            response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema },
            store: false,
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(120_000),
        });
      } catch {
        lastStatus = 0;
        if (attempt < 1) { await sleep(2500); continue; }
        break;
      }

      lastStatus = response.status;
      const body = await response.text();
      if (response.ok) {
        const text = interactionOutputText(JSON.parse(body) as unknown);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }

      // Provider 5xx/429 responses are transient. Never convert one saturated
      // Gemini interaction into a permanent failed athlete job.
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        if (attempt < 1) {
          await sleep(Math.max(Number(response.headers.get('retry-after') || 0) * 1000, 3000));
          continue;
        }
        break;
      }
      if (response.status === 404) break;
      throw new Error(`Gemini rechazó el análisis inline (${response.status}).`);
    }
  }

  if ([0, 404, 429, 500, 502, 503, 504].includes(lastStatus)) {
    throw new Error('GEMINI_BUSY:Gemini no respondió de forma estable. El job seguirá intentando automáticamente sin volver a subir el video.');
  }
  throw new Error(`Gemini rechazó el análisis inline (${lastStatus}).`);
}

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string, externalUrl = false) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const isGeminiFile = /^https:\/\/generativelanguage\.googleapis\.com\//.test(fileUri);
  const candidates = externalUrl || isGeminiFile
    ? ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
    : Array.from(new Set([configured || '', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(Boolean)));
  let lastStatus = 0; let retryAfter = 0;
  for (const model of candidates) {
    const maxAttempts = externalUrl || isGeminiFile ? 2 : 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [{ type: 'video', uri: fileUri, mime_type: mimeType }, { type: 'text', text: prompt }], response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema }, store: false }), cache: 'no-store',
          signal: AbortSignal.timeout(externalUrl ? 120_000 : isGeminiFile ? 150_000 : 4 * 60 * 1000),
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

async function completeAnalysis(
  data: UploadedAnalysisRequest,
  updateJob?: (status: AnalysisJob['status']) => void | Promise<void>,
  savePreparedFile?: (prepared: UploadedAnalysisRequest) => void | Promise<void>,
): Promise<ReportPayload> {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini no está configurado en el servidor.');
    let fileName = val(data, 'fileName'); let fileUri = val(data, 'fileUri'); let mimeType = val(data, 'mimeType', 'video/mp4');
    if (!fileName || !fileUri) {
      const preprocessingStartedAt = Date.now();
      let segments: GeminiPreparedSegment[];
      try {
        segments = await prepareGeminiSegments(data, apiKey, updateJob);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.startsWith('GEMINI_BUSY:')) throw error;

        // Gemini Files has its own capacity limits. If the resumable Files
        // transport is saturated, reuse the same private S3 source and send
        // the compact 0:00–3:00 clip inline through Interactions instead of
        // repeatedly re-uploading the athlete's video and burning the whole
        // durable retry budget in the "uploading" phase.
        const inline = await prepareInlineSegments(data, updateJob);
        const preprocessingMs = Date.now() - preprocessingStartedAt;
        try {
          await updateJob?.('coaching');
          const analysisStartedAt = Date.now();
          const parts = await mapWithConcurrency(inline.segments, Math.min(2, inline.segments.length), async (segment, index) =>
            generateCoachJsonInline(
              apiKey,
              buildSegmentPrompt(data, index, inline.segments.length, segment.offset, segment.duration),
              segment.path,
            )
          );
          const merged = mergeSegmentReports(parts, inline.segments.map(segment => segment.offset));
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
              clip_count: inline.segments.length,
            },
          };
        } finally {
          await inline.cleanup();
        }
      }

      const preprocessingMs = Date.now() - preprocessingStartedAt;
      if (!segments.length) throw new Error('No se pudo preparar el round para análisis rápido.');
      if (segments.length === 1) {
        fileName = segments[0].fileName;
        fileUri = segments[0].fileUri;
        mimeType = 'video/mp4';
        await savePreparedFile?.({ ...data, fileName, fileUri, mimeType });
      }

      await updateJob?.('coaching');
      const analysisStartedAt = Date.now();
      const parts = await mapWithConcurrency(segments, 1, async (segment, index) =>
        generateCoachJson(
          apiKey,
          buildSegmentPrompt(data, index, segments.length, segment.offset, segment.duration),
          segment.fileUri,
          'video/mp4',
          false,
        )
      );
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

async function claimAndRun(job: AnalysisJob, waitForCompletion = false) {
  if (!activeStatus(job.status) || !tableName) return;
  const now = Date.now();
  const staleBefore = now - 2 * 60 * 1000;
  try {
    await dynamo.send(new UpdateItemCommand({
      TableName: tableName, Key: { jobId: { S: job.id } },
      UpdateExpression: 'SET leaseOwner = :owner, leaseExpiresAt = :lease, updatedAt = :updatedAt',
      ConditionExpression: '#status IN (:queued, :downloading, :converting, :uploading, :preparing, :coaching) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now OR updatedAt < :staleBefore)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':owner': { S: workerId }, ':lease': { N: String(now + leaseMs) }, ':updatedAt': { N: String(now) }, ':now': { N: String(now) }, ':staleBefore': { N: String(staleBefore) }, ':queued': { S: 'queued' }, ':downloading': { S: 'downloading' }, ':converting': { S: 'converting' }, ':uploading': { S: 'uploading' }, ':preparing': { S: 'preparing' }, ':coaching': { S: 'coaching' } },
    }));
  } catch { return; }
  const heartbeat = setInterval(() => { void heartbeatJob(job.id); }, 30_000);
  const execution = completeAnalysis(
    job.payload,
    async (status) => updateJob(job.id, status),
    async (payload) => updateJob(job.id, 'preparing', { payload }),
  ).then(
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
  if (waitForCompletion) await execution;
}

async function runAnalysisWorker() {
  if (!tableName || workerScanning) return;
  workerScanning = true;
  try {
    const now = Date.now();
    const staleBefore = now - 2 * 60 * 1000;
    const response = await dynamo.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#status IN (:queued, :downloading, :converting, :uploading, :preparing, :coaching) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now OR updatedAt < :staleBefore)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':now': { N: String(now) }, ':staleBefore': { N: String(staleBefore) }, ':queued': { S: 'queued' }, ':downloading': { S: 'downloading' }, ':converting': { S: 'converting' }, ':uploading': { S: 'uploading' }, ':preparing': { S: 'preparing' }, ':coaching': { S: 'coaching' } },
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

// Queue processing belongs exclusively to scripts/analysis-worker.mjs in the
// dedicated ECS service. Starting a second scanner inside web request tasks
// creates competing Gemini uploads during a deployment or browser poll.

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
      return NextResponse.json({ id, status: reusable.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ id, status: job.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Fight AI uploaded-file analysis error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar el análisis.' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const workerJobId = params.get('workerJob');
  const workerOwner = params.get('workerOwner');
  if (workerJobId && workerOwner) {
    try {
      const job = await getJob(workerJobId);
      const stored = await dynamo.send(new GetItemCommand({ TableName: tableName, Key: { jobId: { S: workerJobId } }, ConsistentRead: true }));
      if (!job || stored.Item?.leaseOwner?.S !== workerOwner) return NextResponse.json({ error: 'El lease pertenece a otro worker.' }, { status: 409 });
      try {
        const report = await completeAnalysis(
          job.payload,
          async (status) => updateJob(job.id, status),
          async (payload) => updateJob(job.id, 'preparing', { payload }),
        );
        await updateJob(job.id, 'complete', { report, clearLease: true });
        return NextResponse.json({ status: 'complete', id: job.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo completar el análisis.';
        if (message.startsWith('GEMINI_BUSY:')) await deferProviderRetry(job.id, 'coaching', message.replace(/^GEMINI_BUSY:/, ''), 45_000);
        else await updateJob(job.id, 'failed', { error: message, clearLease: true });
        return NextResponse.json({ status: 'failed', error: message }, { status: 502 });
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'El worker no pudo ejecutar el trabajo.' }, { status: 502 });
    }
  }
  if (params.get('worker') === '1') {
    try {
      if (!tableName) return NextResponse.json({ error: 'La persistencia de análisis aún no está configurada.' }, { status: 503 });
      const now = Date.now();
      const staleBefore = now - 2 * 60 * 1000;
      const response = await dynamo.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: '#status IN (:queued, :downloading, :converting, :uploading, :preparing, :coaching) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now OR updatedAt < :staleBefore)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':now': { N: String(now) }, ':staleBefore': { N: String(staleBefore) }, ':queued': { S: 'queued' }, ':downloading': { S: 'downloading' }, ':converting': { S: 'converting' }, ':uploading': { S: 'uploading' }, ':preparing': { S: 'preparing' }, ':coaching': { S: 'coaching' } },
      }));
      const job = (response.Items || []).map(itemToJob).find((candidate): candidate is AnalysisJob => Boolean(candidate));
      if (!job) return NextResponse.json({ status: 'idle' }, { headers: { 'Cache-Control': 'no-store' } });
      await claimAndRun(job, true);
      return NextResponse.json({ status: 'processed', id: job.id }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.error('Fight AI worker request error', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : 'El worker no pudo procesar el trabajo.' }, { status: 502 });
    }
  }
  const id = params.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Falta el identificador del trabajo.' }, { status: 400 });
  try {
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: 'El trabajo no está disponible. Puedes reintentar sin volver a subir el video.' }, { status: 404 });
    if (job.status === 'complete' && job.report) return NextResponse.json({ status: job.status, report: job.report }, { headers: { 'Cache-Control': 'no-store' } });
    if (job.status === 'failed') return NextResponse.json({ status: job.status, error: job.error || 'No se pudo completar el análisis.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ status: job.status, updatedAt: job.updatedAt }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Fight AI job lookup error', error);
    return NextResponse.json({ error: 'No se pudo recuperar el trabajo de análisis.' }, { status: 502 });
  }
}
