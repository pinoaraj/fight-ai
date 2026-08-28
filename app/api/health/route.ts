import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backendConfigured = Boolean(process.env.FIGHT_AI_API_URL);

  return NextResponse.json(
    {
      ok: true,
      service: 'fight-ai-web',
      backendConfigured,
      providerAttributionPolicy: 'usedInReport-required',
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
