import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached: Buffer | null = null;

export async function GET() {
  try {
    if (!cached) {
      const source = await readFile(path.join(process.cwd(), 'qa', 'gemini-proof-red-gloves-tiny.b64'), 'utf8');
      cached = Buffer.from(source.replace(/\s+/g, ''), 'base64');
    }
    return new NextResponse(cached, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(cached.length),
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Fight AI demo video error', error);
    return NextResponse.json({ error: 'No se pudo cargar el video de demostración.' }, { status: 500 });
  }
}
