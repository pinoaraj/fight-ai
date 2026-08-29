import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_VIDEO_BYTES = 750 * 1024 * 1024;

function requestedTime(raw: string | null) {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0.1), 8) : 2;
}

/** Generates one JPEG only when the browser cannot decode the uploaded codec. */
export async function POST(req: Request) {
  const size = Number(req.headers.get('content-length') || 0);
  if (size && (!Number.isFinite(size) || size > MAX_VIDEO_BYTES)) {
    return Response.json({ error: 'El video supera el límite para generar un frame compatible.' }, { status: 413 });
  }
  if (!req.body) return Response.json({ error: 'No recibimos el video.' }, { status: 400 });

  const at = requestedTime(new URL(req.url).searchParams.get('time'));
  const encoder = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ss', String(at),
    '-frames:v', '1', '-vf', "scale='min(960,iw)':-2", '-f', 'image2', '-vcodec', 'mjpeg', 'pipe:1',
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  const output: Buffer[] = [];
  const errors: Buffer[] = [];
  let received = 0;
  const source = Readable.fromWeb(req.body as import('stream/web').ReadableStream);

  return new Promise<Response>((resolve) => {
    let complete = false;
    const finish = (response: Response) => {
      if (complete) return;
      complete = true;
      resolve(response);
    };
    const timeout = setTimeout(() => {
      encoder.kill('SIGKILL');
      finish(Response.json({ error: 'La generación del frame tardó demasiado.' }, { status: 504 }));
    }, 45_000);
    const fail = (message: string) => {
      clearTimeout(timeout);
      finish(Response.json({ error: message }, { status: 422 }));
    };
    source.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_VIDEO_BYTES) {
        source.destroy(); encoder.kill('SIGKILL');
        fail('El video supera el límite para generar un frame compatible.');
      }
    });
    source.on('error', () => { encoder.kill('SIGKILL'); fail('No pudimos leer el video para generar el frame.'); });
    encoder.on('error', () => fail('El servicio de compatibilidad de video no está disponible.'));
    encoder.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    encoder.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    encoder.on('close', (code) => {
      clearTimeout(timeout);
      const image = Buffer.concat(output);
      if (code === 0 && image.length) {
        finish(new Response(image, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } }));
        return;
      }
      const detail = Buffer.concat(errors).toString('utf8').trim();
      fail(detail ? 'No se pudo decodificar este video para generar un frame.' : 'No se pudo generar un frame compatible.');
    });
    source.pipe(encoder.stdin);
  });
}
