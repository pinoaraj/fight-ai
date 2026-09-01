import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function secondsToClock(value: number) {
  const total = Math.max(0, Math.round(value));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function textOf(item: unknown) {
  if (!item || typeof item !== 'object') return '';
  const x = item as Record<string, unknown>;
  return [typeof x.title === 'string' ? x.title : '', typeof x.description === 'string' ? x.description : ''].filter(Boolean).join(': ');
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
      correction: typeof x.recommendation === 'string' ? x.recommendation : typeof x.whyItMatters === 'string' ? x.whyItMatters : '',
    }));
  });
  return {
    mode: 'real' as const, provider, usedInReport: providerUsed,
    summary: typeof a.mainTakeaway === 'string' ? a.mainTakeaway : typeof strategy.summary === 'string' ? strategy.summary : 'Análisis completado.',
    strengths: strengthsRaw.map(textOf).filter(Boolean), priorities: weaknessesRaw.map(textOf).filter(Boolean),
    opponent: [...observedOpponent.map(textOf).filter(Boolean), ...hypotheses], plan: rematchPlan.length ? rematchPlan : goals,
    drills: drillsRaw.map(item => {
      if (!item || typeof item !== 'object') return '';
      const x = item as Record<string, unknown>;
      return `${typeof x.name === 'string' ? x.name : 'Drill'}${typeof x.duration === 'string' ? ` · ${x.duration}` : ''}${typeof x.goal === 'string' ? ` — ${x.goal}` : ''}`;
    }).filter(Boolean), evidence,
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
  return JSON.parse(text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()) as Record<string, unknown>;
}

const coachingSchema = {
  type: 'object', properties: {
    summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, priorities: { type: 'array', items: { type: 'string' } },
    opponent: { type: 'array', items: { type: 'string' } }, plan: { type: 'array', items: { type: 'string' } }, drills: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'object', properties: {
      time: { type: 'string' }, title: { type: 'string' }, observation: { type: 'string' }, correction: { type: 'string' },
    }, required: ['time','title','observation','correction'] } },
  }, required: ['summary','strengths','priorities','opponent','plan','drills','evidence'],
};

function interactionOutputText(raw: unknown) {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.steps)) return '';
  const chunks: string[] = [];
  for (const step of data.steps) {
    if (!step || typeof step !== 'object' || !Array.isArray((step as Record<string, unknown>).content)) continue;
    for (const item of (step as { content: unknown[] }).content) if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string') chunks.push((item as { text: string }).text);
  }
  return chunks.join('').trim();
}

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = Array.from(new Set([configured || '', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(Boolean)));
  let lastStatus = 0; let retryAfter = 0;
  for (const model of candidates) {
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: [{ type: 'video', uri: fileUri, mime_type: mimeType }, { type: 'text', text: prompt }], response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema }, store: false }), cache: 'no-store',
          signal: AbortSignal.timeout(4 * 60 * 1000),
        });
      } catch {
        lastStatus = 0;
        if (attempt + 1 < maxAttempts) { await sleep(5000); continue; }
        break;
      }
      lastStatus = response.status; retryAfter = Number(response.headers.get('retry-after') || 0); const body = await response.text();
      if (response.ok) {
        const text = interactionOutputText(JSON.parse(body) as unknown);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }
      if ((response.status === 429 || response.status === 503) && attempt + 1 < maxAttempts) {
        await sleep(Math.max(retryAfter * 1000, 5000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  if (lastStatus === 429 || lastStatus === 503 || lastStatus === 0) {
    throw new Error('Gemini está temporalmente ocupado. El video sigue seguro; vuelve a intentar el análisis en un momento.');
  }
  throw new Error(`Gemini rechazó el análisis (${lastStatus}).`);
}

function field(source: FormData, key: string, fallback = '') { return String(source.get(key) || fallback).trim(); }

async function analyzeWithGemini(source: FormData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini no está configurado en el servidor.');
  const video = source.get('video');
  if (!(video instanceof File) || !video.size) throw new Error('No se recibió un video válido.');
  const mimeType = video.type || 'video/mp4';

  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST', headers: {
      'x-goog-api-key': apiKey, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(video.size), 'X-Goog-Upload-Header-Content-Type': mimeType, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ file: { display_name: video.name || 'fight-ai-sparring.mp4' } }), cache: 'no-store',
  });
  if (!start.ok) throw new Error(`Gemini no pudo iniciar la carga (${start.status}).`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini no devolvió URL de carga.');

  const uploadInit = {
    method: 'POST', headers: { 'Content-Length': String(video.size), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: video.stream(), cache: 'no-store', duplex: 'half',
  } as RequestInit & { duplex: 'half' };
  const uploaded = await fetch(uploadUrl, uploadInit);
  if (!uploaded.ok) throw new Error(`Gemini no pudo cargar el video (${uploaded.status}).`);
  const fileInfo = await uploaded.json() as { file?: { name?: string; uri?: string; state?: string } };
  const fileName = fileInfo.file?.name; const fileUri = fileInfo.file?.uri;
  if (!fileName || !fileUri) throw new Error('Gemini no devolvió referencia del video.');

  let state = fileInfo.file?.state || 'PROCESSING';
  const deadline = Date.now() + 8 * 60 * 1000;
  while (state !== 'ACTIVE' && Date.now() < deadline) {
    if (state === 'FAILED') throw new Error('Gemini no pudo preparar el video.');
    await sleep(2000);
    const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, { headers: { 'x-goog-api-key': apiKey }, cache: 'no-store' });
    if (!status.ok) throw new Error(`No se pudo consultar el estado del video en Gemini (${status.status}).`);
    state = (await status.json() as { state?: string }).state || 'PROCESSING';
  }
  if (state !== 'ACTIVE') throw new Error('Gemini tardó demasiado en preparar el video.');

  const language = field(source, 'language', 'es');
  const sport = field(source, 'sport', 'boxing'); const stance = field(source, 'stance', 'unknown');
  const descriptors = [
    field(source,'glove_color') && `guantes ${field(source,'glove_color')}`,
    field(source,'top_color') && `ropa/polera ${field(source,'top_color')}`,
    field(source,'relative_height') && `altura relativa ${field(source,'relative_height')}`,
    field(source,'build') && `contextura ${field(source,'build')}`,
    field(source,'fighter_notes'),
  ].filter(Boolean).join('; ');
  const anchor = field(source,'anchor_x') && field(source,'anchor_y') ? `El usuario marcó al peleador cerca de x=${field(source,'anchor_x')}%, y=${field(source,'anchor_y')}% del cuadro inicial.` : '';
  const focuses = field(source,'analysis_focus','technique,weaknesses,strategy'); const customFocus = field(source,'custom_focus');
  const languageInstruction = language === 'en' ? 'Write the entire report in English.' : 'Escribe todo el reporte en español natural.';

  const prompt = `Actúa como un entrenador de boxeo/kickboxing de alto nivel haciendo una revisión clínica post-sparring. ${languageInstruction}

VIDEO Y OBJETIVO:
- Disciplina: ${sport}.
- Guardia declarada del atleta: ${stance}.
- Peleador objetivo: ${descriptors || 'peleador seleccionado por el usuario'}.
- ${anchor || 'Mantén la identidad usando las características visibles y continuidad temporal.'}
- Si la identidad se vuelve dudosa, NO cambies de peleador silenciosamente: usa solo momentos en que estés seguro.

FOCO PEDIDO POR EL ATLETA:
- Áreas: ${focuses}.
- Objetivo personalizado: ${customFocus || 'ninguno adicional'}.

ESTÁNDAR DE COACHING:
1. No hagas comentarios genéricos. Busca patrones que se repitan a lo largo del video y explica el contexto exacto en que aparecen.
2. Para cada prioridad conecta: QUÉ sucede visualmente → POR QUÉ probablemente sucede → QUÉ consecuencia técnica/táctica produce → CÓMO corregirlo.
3. Distingue claramente hechos visibles de hipótesis. No inventes conteos de golpes, porcentajes, velocidad, precisión ni estadísticas no verificables.
4. Analiza boxeo real: guardia y recuperación, balance/base, transferencia de peso, entradas, salidas, head movement, defensa tras combinación, distancia, timing, ángulos/pivotes, footwork, selección de golpes, ritmo, presión, reacción al jab, trabajo al cuerpo y decisiones bajo presión cuando sean visibles.
5. Lee al rival: rango preferido, reacciones recurrentes, patrones defensivos/ofensivos, qué está explotando del atleta y qué vulnerabilidades ofrece. Explica cómo convertir esa lectura en un plan de revancha.
6. Prioriza SOLO las 3 correcciones con mayor impacto. Cada prioridad debe ser específica y suficientemente desarrollada para que un entrenador humano la reconozca como útil.
7. Las fortalezas deben explicar cómo explotarlas estratégicamente, no solo felicitarlas.
8. Cada drill debe estar ligado a una prioridad concreta e incluir estructura práctica (por ejemplo rounds/repeticiones) y objetivo técnico.
9. evidence debe usar timestamps MM:SS realmente visibles. Incluye 4–8 momentos si el video lo permite, distribuidos en el round, no todos juntos. observation describe qué se ve; correction dice exactamente qué hacer distinto.
10. summary debe ser un diagnóstico de 4–7 frases: estilo actual, patrón limitante principal, cómo lo explota el rival, fortaleza más útil y cambio #1 para la próxima sesión.

Devuelve exclusivamente JSON válido con summary, strengths, priorities, opponent, plan, drills y evidence.`;

  const parsed = await generateCoachJson(apiKey, prompt, fileUri, mimeType);
  const stringList = (value: unknown) => Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()) as string[] : [];
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter(x => x && typeof x === 'object').map(x => {
    const item = x as Record<string, unknown>;
    return { time: typeof item.time === 'string' ? item.time : '00:00', title: typeof item.title === 'string' ? item.title : 'Evidencia', observation: typeof item.observation === 'string' ? item.observation : '', correction: typeof item.correction === 'string' ? item.correction : '' };
  }).filter(x => /^\d{1,2}:\d{2}$/.test(x.time) && x.observation) : [];

  return {
    mode: 'real' as const, provider: 'Gemini', usedInReport: true,
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado con Gemini.',
    strengths: stringList(parsed.strengths), priorities: stringList(parsed.priorities).slice(0,3), opponent: stringList(parsed.opponent),
    plan: stringList(parsed.plan), drills: stringList(parsed.drills), evidence,
  };
}

export async function POST(req: NextRequest) {
  try {
    const source = await req.formData(); const backend = process.env.FIGHT_AI_API_URL?.replace(/\/$/, '');
    if (!backend) return NextResponse.json(await analyzeWithGemini(source));
    const health = await requestJson(`${backend}/health`) as { asyncJobs?: boolean };
    if (health.asyncJobs) {
      const created = await requestJson(`${backend}/jobs/analyze`, { method: 'POST', body: source }) as { jobId?: string };
      if (!created.jobId) throw new Error('El motor no devolvió un jobId.');
      const deadline = Date.now() + 25 * 60 * 1000;
      while (Date.now() < deadline) {
        await sleep(2200);
        const job = await requestJson(`${backend}/jobs/${encodeURIComponent(created.jobId)}`) as { status?: string; error?: string; result?: { report?: unknown } };
        if (job.status === 'COMPLETED') { if (!job.result?.report) throw new Error('El análisis terminó sin reporte.'); return NextResponse.json(normalizeReport(job.result.report)); }
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
