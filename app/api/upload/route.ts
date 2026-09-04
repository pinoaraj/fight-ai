import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Gemini no está configurado en el servidor.' }, { status: 503 });
    if (!req.body) return NextResponse.json({ error: 'No se recibió video.' }, { status: 400 });

    const rawName = req.headers.get('x-fight-ai-name') || 'fight-ai-sparring.mp4';
    let name = rawName;
    try { name = decodeURIComponent(rawName); } catch { /* keep raw value */ }
    const mimeType = req.headers.get('content-type') || 'video/mp4';
    const sizeHeader = req.headers.get('x-fight-ai-size') || req.headers.get('content-length') || '';
    const size = Number(sizeHeader);
    if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: 'No se pudo determinar el tamaño del video.' }, { status: 411 });

    const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(size),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: name.slice(0, 180) } }),
      cache: 'no-store',
    });
    if (!start.ok) throw new Error(`Gemini no pudo iniciar la carga (${start.status}).`);
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('Gemini no devolvió URL de carga.');

    const uploadInit = {
      method: 'POST',
      headers: {
        'Content-Length': String(size),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: req.body,
      cache: 'no-store',
      duplex: 'half',
    } as RequestInit & { duplex: 'half' };

    const uploaded = await fetch(uploadUrl, uploadInit);
    if (!uploaded.ok) throw new Error(`Gemini no pudo cargar el video (${uploaded.status}).`);
    const fileInfo = await uploaded.json() as { file?: { name?: string; uri?: string; state?: string } };
    if (!fileInfo.file?.name || !fileInfo.file?.uri) throw new Error('Gemini no devolvió referencia del video.');

    return NextResponse.json({
      fileName: fileInfo.file.name,
      fileUri: fileInfo.file.uri,
      mimeType,
      state: fileInfo.file.state || 'PROCESSING',
      size,
      timings: {
        gemini_upload_ms: Date.now() - startedAt,
        total_ms: Date.now() - startedAt,
        original_size_bytes: size,
        processed_size_bytes: size,
        clip_count: 1,
      },
    });
  } catch (error) {
    console.error('Fight AI streaming upload error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo subir el video.' }, { status: 502 });
  }
}
