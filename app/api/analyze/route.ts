import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function secondsToClock(value: number) {
  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function textOf(item: unknown) {
  if (!item || typeof item !== 'object') return '';
  const x = item as Record<string, unknown>;
  const title = typeof x.title === 'string' ? x.title : '';
  const description = typeof x.description === 'string' ? x.description : '';
  return [title, description].filter(Boolean).join(': ');
}

function normalizeReport(raw: unknown) {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const strengthsRaw = Array.isArray(a.strengths) ? a.strengths : [];
  const weaknessesRaw = Array.isArray(a.weaknesses) ? a.weaknesses : [];
  const drillsRaw = Array.isArray(a.drills) ? a.drills : [];
  const strategy = (a.strategy && typeof a.strategy === 'object' ? a.strategy : {}) as Record<string, unknown>;
  const opponentAnalysis = (strategy.opponentAnalysis && typeof strategy.opponentAnalysis === 'object' ? strategy.opponentAnalysis : {}) as Record<string, unknown>;
  const observedOpponent = Array.isArray(opponentAnalysis.observedOpponentPatterns) ? opponentAnalysis.observedOpponentPatterns : [];
  const hypotheses = Array.isArray(opponentAnalysis.tacticalHypotheses) ? opponentAnalysis.tacticalHypotheses.filter(x => typeof x === 'string') as string[] : [];
  const rematchPlan = Array.isArray(opponentAnalysis.rematchPlan) ? opponentAnalysis.rematchPlan.filter(x => typeof x === 'string') as string[] : [];
  const goals = Array.isArray(a.nextSessionGoals) ? a.nextSessionGoals.filter(x => typeof x === 'string') as string[] : [];
  const realVision = (a.realVision && typeof a.realVision === 'object' ? a.realVision : {}) as Record<string, unknown>;
  const videoAI = (realVision.videoAI && typeof realVision.videoAI === 'object' ? realVision.videoAI : {}) as Record<string, unknown>;
  const providerUsed = videoAI.usedInReport === true;
  const provider = providerUsed && typeof videoAI.provider === 'string' ? videoAI.provider : 'CV / Pose';

  const evidence = [...weaknessesRaw, ...strengthsRaw].flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const x = item as Record<string, unknown>;
    const timestamps = Array.isArray(x.timestamps) ? x.timestamps.filter(v => typeof v === 'number') as number[] : [];
    return timestamps.map(timestamp => ({
      time: secondsToClock(timestamp),
      title: typeof x.title === 'string' ? x.title : 'Evidencia',
      observation: typeof x.description === 'string' ? x.description : '',
      correction: typeof x.recommendation === 'string'
        ? x.recommendation
        : typeof x.whyItMatters === 'string' ? x.whyItMatters : '',
    }));
  });

  return {
    mode: 'real' as const,
    provider,
    usedInReport: providerUsed,
    summary: typeof a.mainTakeaway === 'string'
      ? a.mainTakeaway
      : typeof strategy.summary === 'string' ? strategy.summary : 'Análisis completado.',
    strengths: strengthsRaw.map(textOf).filter(Boolean),
    priorities: weaknessesRaw.map(textOf).filter(Boolean),
    opponent: [...observedOpponent.map(textOf).filter(Boolean), ...hypotheses],
    plan: rematchPlan.length ? rematchPlan : goals,
    drills: drillsRaw.map(item => {
      if (!item || typeof item !== 'object') return '';
      const x = item as Record<string, unknown>;
      const name = typeof x.name === 'string' ? x.name : 'Drill';
      const duration = typeof x.duration === 'string' ? ` · ${x.duration}` : '';
      const goal = typeof x.goal === 'string' ? ` — ${x.goal}` : '';
      return `${name}${duration}${goal}`;
    }).filter(Boolean),
    evidence,
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (process.env.FIGHT_AI_WEB_TOKEN) headers.set('Authorization', `Bearer ${process.env.FIGHT_AI_WEB_TOKEN}`);
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error(`Respuesta inválida del motor (${response.status}).`); }
  if (!response.ok) throw new Error((data as { error?: string })?.error || text || `HTTP ${response.status}`);
  return data;
}

export async function POST(req: NextRequest) {
  const backend = process.env.FIGHT_AI_API_URL?.replace(/\/$/, '');
  if (!backend) {
    return NextResponse.json({ error: 'Backend de Fight AI no conectado en esta web todavía.' }, { status: 503 });
  }

  try {
    const source = await req.formData();
    const health = await requestJson(`${backend}/health`) as { asyncJobs?: boolean };

    if (health.asyncJobs) {
      const created = await requestJson(`${backend}/jobs/analyze`, { method: 'POST', body: source }) as { jobId?: string };
      if (!created.jobId) throw new Error('El motor no devolvió un jobId.');

      const deadline = Date.now() + 25 * 60 * 1000;
      while (Date.now() < deadline) {
        await sleep(2200);
        const job = await requestJson(`${backend}/jobs/${encodeURIComponent(created.jobId)}`) as {
          status?: string;
          error?: string;
          result?: { report?: unknown };
        };
        if (job.status === 'COMPLETED') {
          if (!job.result?.report) throw new Error('El análisis terminó sin reporte.');
          return NextResponse.json(normalizeReport(job.result.report));
        }
        if (job.status === 'FAILED') throw new Error(job.error || 'El motor detuvo el análisis.');
      }
      throw new Error('El análisis superó el tiempo máximo de espera (25 min).');
    }

    const legacy = await requestJson(`${backend}/analyze`, { method: 'POST', body: source }) as { report?: unknown };
    if (!legacy.report) throw new Error('El motor no devolvió reporte.');
    return NextResponse.json(normalizeReport(legacy.report));
  } catch (error) {
    console.error('Fight AI web proxy error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo conectar con el motor de análisis.' }, { status: 502 });
  }
}
