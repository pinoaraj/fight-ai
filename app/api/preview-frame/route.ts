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

function requestedTime(raw: string | null) {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0.1), 8) : 2;
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
      const detail = Buffer.concat(errors).toString('utf8').trim();
      console.error('Fight AI compatible-frame error', detail || `ffmpeg exited with ${code}`);
      reject(new Error(detail || 'frame generation failed'));
    });
  });
}

/**
 * Some phone MP4s have an HEVC 10-bit stream. Chrome can read their metadata
 * but cannot paint a frame. Stage the incoming file on ephemeral disk first:
 * FFmpeg needs a seekable MP4 to reliably follow its sample offsets.
 */
export async function POST(req: Request) {
  const size = Number(req.headers.get('content-length') || 0);
  if (size && (!Number.isFinite(size) || size > MAX_VIDEO_BYTES)) {
    return Response.json({ error: 'El video supera el límite para generar un frame compatible.' }, { status: 413 });
  }
  if (!req.body) return Response.json({ error: 'No recibimos el video.' }, { status: 400 });

  const temporaryPath = join(tmpdir(), `fight-ai-frame-${randomUUID()}.mp4`);
  const at = requestedTime(new URL(req.url).searchParams.get('time'));
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
    const image = await renderFrame(temporaryPath, at);
    return new Response(image, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
  } catch (error) {
    const isTooLarge = error instanceof Error && error.message === 'video too large';
    return Response.json({ error: isTooLarge ? 'El video supera el límite para generar un frame compatible.' : 'No se pudo decodificar este video para generar un frame.' }, { status: isTooLarge ? 413 : 422 });
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}
