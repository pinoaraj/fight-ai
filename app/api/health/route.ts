import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const runtimeMode = (process.env.FIGHT_AI_RUNTIME || 'cloud').trim().toLowerCase();
  const localMode = runtimeMode === 'local';
  const backendConfigured = Boolean(process.env.FIGHT_AI_API_URL);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return NextResponse.json(
    {
      ok: true,
      service: 'fight-ai-web',
      runtimeMode,
      localMode,
      backendConfigured,
      geminiConfigured,
      analysisReady: localMode ? geminiConfigured : backendConfigured || geminiConfigured,
      buildSha: process.env.FIGHT_AI_BUILD_SHA || 'unknown',
      providerAttributionPolicy: 'usedInReport-required',
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
