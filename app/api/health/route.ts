import { NextResponse } from 'next/server';
import { BOXING_KNOWLEDGE_SOURCES, BOXING_KNOWLEDGE_VERSION } from '../../../lib/boxingKnowledge';

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
      hybridKnowledge: {
        enabled: true,
        version: BOXING_KNOWLEDGE_VERSION,
        verifiedSourceCount: Object.keys(BOXING_KNOWLEDGE_SOURCES).length,
        policy: 'video-evidence-first',
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
