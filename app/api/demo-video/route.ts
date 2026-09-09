import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached: Buffer | null = null;

async function demoBytes() {
  if (!cached) {
    const source = await readFile(path.join(process.cwd(), 'qa', 'gemini-proof-red-gloves-tiny.b64'), 'utf8');
    cached = Buffer.from(source.replace(/\s+/g, ''), 'base64');
  }
  return cached;
}

export async function GET(req: NextRequest) {
  try {
    const bytes = await demoBytes();
    const range = req.headers.get('range');
    const common = { 'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes' };
    if (!range) return new NextResponse(new Uint8Array(bytes), { status: 200, headers: { ...common, 'Content-Length': String(bytes.length) } });

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new NextResponse(null, { status: 416, headers: { ...common, 'Content-Range': `bytes */${bytes.length}` } });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= bytes.length) {
      return new NextResponse(null, { status: 416, headers: { ...common, 'Content-Range': `bytes */${bytes.length}` } });
    }
    const chunk = bytes.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), { status: 206, headers: { ...common, 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } });
  } catch (error) {
    console.error('Fight AI demo video error', error);
    return NextResponse.json({ error: 'No se pudo cargar el video de demostración.' }, { status: 500 });
  }
}
