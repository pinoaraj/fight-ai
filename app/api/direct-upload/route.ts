import { CreateMultipartUploadCommand, CompleteMultipartUploadCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const bucket = process.env.FIGHT_AI_INGEST_BUCKET || '';
const region = process.env.AWS_REGION || 'sa-east-1';
const s3 = new S3Client({ region });

export async function POST(req: NextRequest) {
  if (!bucket) return NextResponse.json({ error: 'La carga directa aún no está configurada.' }, { status: 503 });
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('proxy') === '1') {
      const key = url.searchParams.get('key') || '';
      const uploadId = url.searchParams.get('uploadId') || '';
      const partNumber = Number(url.searchParams.get('partNumber') || '0');
      if (!key.startsWith('uploads/') || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        return NextResponse.json({ error: 'Parte de carga inválida.' }, { status: 400 });
      }
      const bytes = Buffer.from(await req.arrayBuffer());
      if (!bytes.length) return NextResponse.json({ error: 'La parte del video está vacía.' }, { status: 400 });
      const uploaded = await s3.send(new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: bytes }));
      if (!uploaded.ETag) return NextResponse.json({ error: 'S3 no confirmó la parte del video.' }, { status: 502 });
      return NextResponse.json({ ETag: uploaded.ETag, PartNumber: partNumber });
    }
    const body = await req.json() as { action?: string; name?: string; type?: string; key?: string; uploadId?: string; partNumber?: number; parts?: { ETag: string; PartNumber: number }[] };
    if (body.action === 'start') {
      const key = `uploads/${crypto.randomUUID()}-${(body.name || 'sparring.mp4').replace(/[^\w.-]/g, '_')}`;
      const created = await s3.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: body.type || 'video/mp4', ServerSideEncryption: 'AES256' }));
      return NextResponse.json({ key, uploadId: created.UploadId });
    }
    const partNumber = body.partNumber;
    if (body.action === 'sign' && body.key && body.key.startsWith('uploads/') && body.uploadId && typeof partNumber === 'number' && Number.isInteger(partNumber) && partNumber > 0 && partNumber <= 10000) {
      const url = await getSignedUrl(s3, new UploadPartCommand({ Bucket: bucket, Key: body.key, UploadId: body.uploadId, PartNumber: partNumber }), { expiresIn: 3600 });
      return NextResponse.json({ url });
    }
    if (body.action === 'complete' && body.key && body.key.startsWith('uploads/') && body.uploadId && body.parts?.length && body.parts.every((part) => Number.isInteger(part.PartNumber) && part.PartNumber > 0 && part.PartNumber <= 10000 && typeof part.ETag === 'string')) {
      await s3.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: body.key, UploadId: body.uploadId, MultipartUpload: { Parts: body.parts } }));
      return NextResponse.json({ key: body.key });
    }
    return NextResponse.json({ error: 'Solicitud de carga inválida.' }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cargar el video.' }, { status: 502 }); }
}
