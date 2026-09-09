import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_VIDEO_BYTES = 750 * 1024 * 1024;
// Next's production request bridge may cap a single streamed body near 10 MB.
// Stay below it and verify every byte so a truncated MP4 is never accepted.
const MAX_CHUNK_BYTES = 9 * 1024 * 1024;
const MAX_CHUNKS = 96;

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

async function receiveBody(req: Request, destination: string, limit: number) {
  if (!req.body) throw new Error('missing body');
  let received = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > limit) return callback(new Error('video too large'));
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(req.body as import('stream/web').ReadableStream), meter, createWriteStream(destination));
  return received;
}

async function chunkedFrame(req: Request, url: URL, at: number) {
  const uploadId = url.searchParams.get('uploadId') || '';
  const part = Number(url.searchParams.get('part'));
  const parts = Number(url.searchParams.get('parts'));
  const totalBytes = Number(url.searchParams.get('totalBytes'));
  if (!/^[a-f0-9-]{16,64}$/i.test(uploadId) || !Number.isInteger(part) || !Number.isInteger(parts) || !Number.isInteger(totalBytes) || totalBytes < 1 || totalBytes > MAX_VIDEO_BYTES || part < 0 || parts < 1 || parts > MAX_CHUNKS || part >= parts) {
    return Response.json({ error: 'Sesión de frame inválida.' }, { status: 400 });
  }

  const sessionDir = join(tmpdir(), `fight-ai-frame-parts-${uploadId}`);
  const assembledPath = join(tmpdir(), `fight-ai-staged-${uploadId}.mp4`);
  await mkdir(sessionDir, { recursive: true });
  try {
    const received = await receiveBody(req, join(sessionDir, `${part}.part`), MAX_CHUNK_BYTES);
    const declared = Number(req.headers.get('content-length') || 0);
    if (!received || (declared && received !== declared)) throw new Error('incomplete chunk');
    if (part < parts - 1) return Response.json({ received: part + 1, parts }, { status: 202 });

    const partPaths = Array.from({ length: parts }, (_, index) => join(sessionDir, `${index}.part`));
    const sizes = await Promise.all(partPaths.map(path => stat(path)));
    const total = sizes.reduce((sum, item) => sum + item.size, 0);
    if (!total || total > MAX_VIDEO_BYTES) throw new Error('video too large');
    if (total !== totalBytes) throw new Error('incomplete chunk');

    await unlink(assembledPath).catch(() => undefined);
    for (let index = 0; index < partPaths.length; index++) {
      await pipeline(
        createReadStream(partPaths[index]),
        createWriteStream(assembledPath, { flags: index === 0 ? 'w' : 'a' }),
      );
    }
    const image = await renderFrame(assembledPath, at);
    await rm(sessionDir, { recursive: true, force: true });
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'X-Fight-AI-Staged-Video': uploadId,
      },
    });
  } catch (error) {
    // Preserve already uploaded chunks on transient failures so the browser can
    // retry only the failed part instead of restarting a large remote video.
    await unlink(join(sessionDir, `${part}.part`)).catch(() => undefined);
    await unlink(assembledPath).catch(() => undefined);
    const isTooLarge = error instanceof Error && error.message === 'video too large';
    return Response.json(
      { error: isTooLarge ? 'El video supera el límite para generar un frame compatible.' : 'No se pudo recibir o reconstruir este bloque del video.', retryable: !isTooLarge, part },
      { status: isTooLarge ? 413 : 422 },
    );
  }
}

/**
 * Some phone MP4s have an HEVC 10-bit stream. Chrome can read their metadata
 * but cannot paint a frame. Stage the incoming file on ephemeral disk first:
 * FFmpeg needs a seekable MP4 to reliably follow its sample offsets.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const at = requestedTime(url.searchParams.get('time'));
  if (url.searchParams.has('uploadId')) return chunkedFrame(req, url, at);

  const size = Number(req.headers.get('content-length') || 0);
  if (size && (!Number.isFinite(size) || size > MAX_VIDEO_BYTES)) {
    return Response.json({ error: 'El video supera el límite para generar un frame compatible.' }, { status: 413 });
  }
  if (!req.body) return Response.json({ error: 'No recibimos el video.' }, { status: 400 });

  const temporaryPath = join(tmpdir(), `fight-ai-frame-${randomUUID()}.mp4`);

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
    return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
  } catch (error) {
    const isTooLarge = error instanceof Error && error.message === 'video too large';
    return Response.json({ error: isTooLarge ? 'El video supera el límite para generar un frame compatible.' : 'No se pudo decodificar este video para generar un frame.' }, { status: isTooLarge ? 413 : 422 });
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

export async function DELETE(req: Request) {
  const uploadId = new URL(req.url).searchParams.get('uploadId') || '';
  if (!/^[a-f0-9-]{16,64}$/i.test(uploadId)) return Response.json({ error: 'Sesión inválida.' }, { status: 400 });
  await Promise.all([
    rm(join(tmpdir(), `fight-ai-frame-parts-${uploadId}`), { recursive: true, force: true }).catch(() => undefined),
    unlink(join(tmpdir(), `fight-ai-staged-${uploadId}.mp4`)).catch(() => undefined),
  ]);
  return Response.json({ deleted: true });
}
