import { AttributeValue, DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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

function makeThreeMinuteClip(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-t', '180', '-map', '0:v:0?', '-map', '0:a?', '-vf', "scale='min(854,iw)':-2,fps=15", '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '27', '-threads', '2', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', outputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('El recorte del round tardó demasiado.')); }, 5 * 60 * 1000);
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

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = Array.from(new Set([configured || '', 'gemini-3.6-flash', 'gemini-3.5-flash'].filter(Boolean)));
  let lastStatus = 0; let retryAfter = 0;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: [{ type: 'video', uri: fileUri, mime_type: mimeType }, { type: 'text', text: prompt }], response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema }, store: false }), cache: 'no-store',
      });
      lastStatus = response.status; retryAfter = Number(response.headers.get('retry-after') || 0);
      const body = await response.text();
      if (response.ok) {
        const text = interactionOutputText(JSON.parse(body) as unknown);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }
      if ((response.status === 429 || response.status === 503) && attempt < 4) { await sleep(Math.max(retryAfter * 1000, 8000 * (attempt + 1))); continue; }
      break;
    }
  }
  throw new Error(lastStatus === 429 ? 'Gemini está temporalmente ocupado. Conservamos tu video: reintenta en 60 segundos sin volver a subirlo.' : `Gemini rechazó el análisis (${lastStatus || 'sin estado'}).`);
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
      await updateJob?.('preparing');
      const uploaded = await uploadS3VideoToGemini(data, apiKey, updateJob);
      fileName = uploaded.fileName; fileUri = uploaded.fileUri; mimeType = uploaded.mimeType;
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
  void completeAnalysis(job.payload, async (status) => updateJob(job.id, status)).then(
    (report) => updateJob(job.id, 'complete', { report, clearLease: true }),
    (error) => {
      console.error('Fight AI uploaded-file async analysis error', error);
      return updateJob(job.id, 'failed', { error: error instanceof Error ? error.message : 'No se pudo completar el análisis.', clearLease: true });
    },
  );
}

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
      await claimAndRun(existing);
      return NextResponse.json({ id, status: existing.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
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
    return NextResponse.json({ status: job.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Fight AI job lookup error', error);
    return NextResponse.json({ error: 'No se pudo recuperar el trabajo de análisis.' }, { status: 502 });
  }
}
