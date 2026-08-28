import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const backend = process.env.FIGHT_AI_API_URL;
  if (!backend) {
    return NextResponse.json({ error: 'Backend de Fight AI no conectado en esta web todavía.' }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const upstream = await fetch(`${backend.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      body: form,
      headers: process.env.FIGHT_AI_WEB_TOKEN ? { Authorization: `Bearer ${process.env.FIGHT_AI_WEB_TOKEN}` } : undefined,
      cache: 'no-store',
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: `Backend devolvió una respuesta inválida (${upstream.status}).` }, { status: 502 });
    }
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error('Fight AI web proxy error', error);
    return NextResponse.json({ error: 'No se pudo conectar con el motor de análisis.' }, { status: 502 });
  }
}
