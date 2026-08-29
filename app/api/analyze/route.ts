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

function cleanGeminiJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed) as Record<string, unknown>;
}

const coachingSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    priorities: { type: 'array', items: { type: 'string' } },
    opponent: { type: 'array', items: { type: 'string' } },
    plan: { type: 'array', items: { type: 'string' } },
    drills: { type: 'array', items: { type: 'string' } },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string' },
          title: { type: 'string' },
          observation: { type: 'string' },
          correction: { type: 'string' },
        },
        required: ['time', 'title', 'observation', 'correction'],
      },
    },
  },
  required: ['summary', 'strengths', 'priorities', 'opponent', 'plan', 'drills', 'evidence'],
};

function interactionOutputText(raw: unknown) {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.steps)) return '';
  const chunks: string[] = [];
  for (const step of data.steps) {
    if (!step || typeof step !== 'object') continue;
    const content = (step as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (!item || typeof item !== 'object') continue;
      const text = (item as Record<string, unknown>).text;
      if (typeof text === 'string') chunks.push(text);
    }
  }
  return chunks.join('').trim();
}

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string) {
  const configured = process.env.GEMINI_MODEL;
  const candidates = Array.from(new Set([
    configured && configured !== 'gemini-2.5-flash' && configured !== 'gemini-3.7-flash' ? configured : '',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ].filter(Boolean)));

  let lastStatus = 0;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          input: [
            { type: 'video', uri: fileUri, mime_type: mimeType },
            { type: 'text', text: prompt },
          ],
          response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema },
          store: false,
        }),
        cache: 'no-store',
      });
      lastStatus = response.status;
      const body = await response.text();
      if (response.ok) {
        const json = JSON.parse(body) as unknown;
        const text = interactionOutputText(json);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }
      if ((response.status === 429 || response.status === 503) && attempt < 2) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw new Error(`Gemini rechazó el análisis (${lastStatus || 'sin estado'}).`);
}

async function analyzeWithGemini(source: FormData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini no está configurado en el servidor.');

  const video = source.get('video');
  if (!(video instanceof File)) throw new Error('No se recibió un video válido.');
  const mimeType = video.type || 'video/mp4';
  const size = video.size;
  if (!size) throw new Error('El video está vacío.');

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
    body: JSON.stringify({ file: { display_name: video.name || 'fight-ai-sparring.mp4' } }),
    cache: 'no-store',
  });
  if (!start.ok) throw new Error(`Gemini no pudo iniciar la carga (${start.status}).`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini no devolvió URL de carga.');

  const bytes = await video.arrayBuffer();
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
    cache: 'no-store',
  });
  if (!uploaded.ok) throw new Error(`Gemini no pudo cargar el video (${uploaded.status}).`);
  const fileInfo = await uploaded.json() as { file?: { name?: string; uri?: string; state?: string } };
  const fileName = fileInfo.file?.name;
  const fileUri = fileInfo.file?.uri;
  if (!fileName || !fileUri) throw new Error('Gemini no devolvió referencia del video.');

  let state = fileInfo.file?.state || 'PROCESSING';
  for (let i = 0; i < 40 && state !== 'ACTIVE'; i += 1) {
    if (state === 'FAILED') throw new Error('Gemini no pudo procesar el video.');
    await sleep(1500);
    const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
      headers: { 'x-goog-api-key': apiKey },
      cache: 'no-store',
    });
    if (!status.ok) throw new Error(`No se pudo consultar el estado del video en Gemini (${status.status}).`);
    const statusJson = await status.json() as { state?: string };
    state = statusJson.state || 'PROCESSING';
  }
  if (state !== 'ACTIVE') throw new Error('Gemini todavía no termina de preparar el video.');

  const target = String(source.get('glove_color') || source.get('athlete_marker') || 'peleador seleccionado');
  const sport = String(source.get('sport') || 'boxing');
  const stance = String(source.get('stance') || 'unknown');
  const prompt = `Analiza este video de sparring de ${sport}. Evalúa SOLO al peleador objetivo: ${target}. Guardia declarada: ${stance}. Responde en español como coach técnico. No inventes conteos exactos de golpes ni estadísticas que el video no permita verificar. Separa observaciones visibles de hipótesis tácticas. Devuelve un reporte JSON con summary, strengths, priorities, opponent, plan, drills y evidence. Cada evidence debe incluir time en MM:SS, title, observation y correction. Usa timestamps solo cuando tengas evidencia visible. Máximo 3 prioridades principales y recomendaciones accionables.`;
  const parsed = await generateCoachJson(apiKey, prompt, fileUri, mimeType);

  const stringList = (value: unknown) => Array.isArray(value) ? value.filter(x => typeof x === 'string') as string[] : [];
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter(x => x && typeof x === 'object').map(x => {
    const item = x as Record<string, unknown>;
    return {
      time: typeof item.time === 'string' ? item.time : '00:00',
      title: typeof item.title === 'string' ? item.title : 'Evidencia',
      observation: typeof item.observation === 'string' ? item.observation : '',
      correction: typeof item.correction === 'string' ? item.correction : '',
    };
  }) : [];

  return {
    mode: 'real' as const,
    provider: 'Gemini',
    usedInReport: true,
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado con Gemini.',
    strengths: stringList(parsed.strengths),
    priorities: stringList(parsed.priorities).slice(0, 3),
    opponent: stringList(parsed.opponent),
    plan: stringList(parsed.plan),
    drills: stringList(parsed.drills),
    evidence,
  };
}

export async function POST(req: NextRequest) {
  try {
    const source = await req.formData();
    const backend = process.env.FIGHT_AI_API_URL?.replace(/\/$/, '');

    if (!backend) {
      return NextResponse.json(await analyzeWithGemini(source));
    }

    const health = await requestJson(`${backend}/health`) as { asyncJobs?: boolean };
    if (health.asyncJobs) {
      const created = await requestJson(`${backend}/jobs/analyze`, { method: 'POST', body: source }) as { jobId?: string };
      if (!created.jobId) throw new Error('El motor no devolvió un jobId.');
      const deadline = Date.now() + 25 * 60 * 1000;
      while (Date.now() < deadline) {
        await sleep(2200);
        const job = await requestJson(`${backend}/jobs/${encodeURIComponent(created.jobId)}`) as { status?: string; error?: string; result?: { report?: unknown } };
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
    console.error('Fight AI web analysis error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar el análisis.' }, { status: 502 });
  }
}
