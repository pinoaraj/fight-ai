import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_VIDEO_BYTES = 750 * 1024 * 1024;
const MAX_FRAMES = 4;

function requestedTimes(raw: string | null) {
  const values = (raw || '').split(',').map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 60 * 10)
    .slice(0, MAX_FRAMES);
  return [...new Set(values.map((value) => Math.round(value * 10) / 10))];
}

function renderFrame(filePath: string, at: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const encoder = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', filePath,
      '-frames:v', '1', '-vf', "scale='min(960,iw)':-2", '-strict', '-2', '-f', 'image2', '-vcodec', 'mjpeg', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    const timeout = setTimeout(() => { encoder.kill('SIGKILL'); reject(new Error('timeout')); }, 45_000);
    encoder.on('error', () => { clearTimeout(timeout); reject(new Error('ffmpeg unavailable')); });
    encoder.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      const image = Buffer.concat(output);
      if (code === 0 && image.length) return resolve(image);
      reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'frame generation failed'));
    });
  });
}

/**
 * Evidence thumbnails are generated server-side when a browser cannot paint
 * the source codec (for example HEVC Main 10). Each returned image is a JPEG
 * extracted from the uploaded video at the report's own timestamp.
 */
export async function POST(req: Request) {
  const times = requestedTimes(new URL(req.url).searchParams.get('times'));
  if (!times.length) return Response.json({ error: 'Faltan timestamps de evidencia.' }, { status: 400 });
  const size = Number(req.headers.get('content-length') || 0);
  if (size && (!Number.isFinite(size) || size > MAX_VIDEO_BYTES)) {
    return Response.json({ error: 'El video supera el límite para generar evidencias.' }, { status: 413 });
  }
  if (!req.body) return Response.json({ error: 'No recibimos el video.' }, { status: 400 });

  const temporaryPath = join(tmpdir(), `fight-ai-evidence-${randomUUID()}.mp4`);
  let received = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_VIDEO_BYTES) return callback(new Error('video too large'));
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(req.body as import('stream/web').ReadableStream), meter, createWriteStream(temporaryPath, { flags: 'wx' }));
    const images = await Promise.all(times.map(async (time) => [String(time), (await renderFrame(temporaryPath, time)).toString('base64')] as const));
    return Response.json({ frames: Object.fromEntries(images.map(([time, image]) => [time, `data:image/jpeg;base64,${image}`])) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const isTooLarge = error instanceof Error && error.message === 'video too large';
    return Response.json({ error: isTooLarge ? 'El video supera el límite para generar evidencias.' : 'No se pudieron generar las capturas de evidencia.' }, { status: isTooLarge ? 413 : 422 });
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}
