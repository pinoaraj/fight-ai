import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type UploadedAnalysisRequest = {
  fileName?: string; fileUri?: string; mimeType?: string; language?: string; sport?: string; stance?: string;
  glove_color?: string; top_color?: string; relative_height?: string; build?: string; fighter_notes?: string;
  anchor_x?: string; anchor_y?: string; anchor_size?: string; anchor_time?: string;
  analysis_focus?: string; custom_focus?: string;
};

type ReportPayload = {
  mode: 'real'; provider: 'Gemini'; usedInReport: true; summary: string;
  strengths: string[]; priorities: string[]; opponent: string[]; plan: string[]; drills: string[];
  evidence: { time: string; title: string; observation: string; correction: string }[];
  timings: { preprocessing_ms: number; gemini_processing_ms: number; analysis_ms: number; total_ms: number; clip_count: number };
};
type AnalysisJob = {
  id: string; status: 'preparing' | 'coaching' | 'complete' | 'failed'; updatedAt: number;
  report?: ReportPayload; error?: string;
};

const jobScope = globalThis as typeof globalThis & { __fightAiUploadedJobs?: Map<string, AnalysisJob> };
const jobs = jobScope.__fightAiUploadedJobs ?? new Map<string, AnalysisJob>();
jobScope.__fightAiUploadedJobs = jobs;

const coachingSchema = {
  type: 'object', properties: {
    summary: { type: 'string' }, strengths: { type: 'array', items: { type: 'string' } }, priorities: { type: 'array', items: { type: 'string' } },
    opponent: { type: 'array', items: { type: 'string' } }, plan: { type: 'array', items: { type: 'string' } }, drills: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'object', properties: {
      time: { type: 'string' }, title: { type: 'string' }, observation: { type: 'string' }, correction: { type: 'string' },
    }, required: ['time','title','observation','correction'] } },
  }, required: ['summary','strengths','priorities','opponent','plan','drills','evidence'],
};

function cleanGeminiJson(text: string) {
  return JSON.parse(text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()) as Record<string, unknown>;
}

function interactionOutputText(raw: unknown) {
  if (!raw || typeof raw !== 'object') return '';
  const data = raw as Record<string, unknown>;
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data.steps)) return '';
  const chunks: string[] = [];
  for (const step of data.steps) {
    if (!step || typeof step !== 'object' || !Array.isArray((step as Record<string, unknown>).content)) continue;
    for (const item of (step as { content: unknown[] }).content) {
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string') chunks.push((item as { text: string }).text);
    }
  }
  return chunks.join('').trim();
}

async function generateCoachJson(apiKey: string, prompt: string, fileUri: string, mimeType: string) {
  const configured = process.env.GEMINI_MODEL?.trim();
  const candidates = Array.from(new Set([configured || '', 'gemini-3.6-flash', 'gemini-3.5-flash'].filter(Boolean)));
  let lastStatus = 0;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: [{ type: 'video', uri: fileUri, mime_type: mimeType }, { type: 'text', text: prompt }], response_format: { type: 'text', mime_type: 'application/json', schema: coachingSchema }, store: false }), cache: 'no-store',
      });
      lastStatus = response.status;
      const body = await response.text();
      if (response.ok) {
        const text = interactionOutputText(JSON.parse(body) as unknown);
        if (!text) throw new Error('Gemini no devolvió contenido de análisis.');
        return cleanGeminiJson(text);
      }
      if ((response.status === 429 || response.status === 503) && attempt < 2) { await sleep(1500 * (attempt + 1)); continue; }
      break;
    }
  }
  throw new Error(`Gemini rechazó el análisis (${lastStatus || 'sin estado'}).`);
}

function val(data: UploadedAnalysisRequest, key: keyof UploadedAnalysisRequest, fallback = '') {
  const value = data[key]; return typeof value === 'string' ? value.trim() : fallback;
}

async function completeAnalysis(data: UploadedAnalysisRequest, updateJob?: (status: AnalysisJob['status']) => void): Promise<ReportPayload> {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini no está configurado en el servidor.');
    const fileName = val(data, 'fileName'); const fileUri = val(data, 'fileUri'); const mimeType = val(data, 'mimeType', 'video/mp4');
    if (!fileName || !fileUri) throw new Error('Falta la referencia del video cargado.');
    if (!fileName.startsWith('files/') || !/^https:\/\/generativelanguage\.googleapis\.com\//.test(fileUri)) {
      throw new Error('Referencia de video no válida.');
    }

    const processingStartedAt = Date.now();
    updateJob?.('preparing');
    let state = 'PROCESSING';
    const deadline = Date.now() + 8 * 60 * 1000;
    while (state !== 'ACTIVE' && Date.now() < deadline) {
      const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, { headers: { 'x-goog-api-key': apiKey }, cache: 'no-store' });
      if (!status.ok) throw new Error(`No se pudo consultar el estado del video en Gemini (${status.status}).`);
      state = (await status.json() as { state?: string }).state || 'PROCESSING';
      if (state === 'FAILED') throw new Error('Gemini no pudo preparar el video.');
      if (state !== 'ACTIVE') await sleep(1800);
    }
    if (state !== 'ACTIVE') throw new Error('Gemini tardó demasiado en preparar el video.');

    const descriptors = [
      val(data,'glove_color') && `guantes ${val(data,'glove_color')}`,
      val(data,'top_color') && `ropa/polera ${val(data,'top_color')}`,
      val(data,'relative_height') && `altura relativa ${val(data,'relative_height')}`,
      val(data,'build') && `contextura ${val(data,'build')}`,
      val(data,'fighter_notes'),
    ].filter(Boolean).join('; ');
    const anchorTime = Number(val(data, 'anchor_time', '0')) || 0;
    const anchor = val(data,'anchor_x') && val(data,'anchor_y')
      ? `El usuario marcó al peleador en t=${anchorTime.toFixed(1)}s cerca de x=${val(data,'anchor_x')}%, y=${val(data,'anchor_y')}%, con círculo aproximado ${val(data,'anchor_size','24')}% del ancho. Usa ESE momento como ancla visual y sigue la misma identidad por continuidad temporal.`
      : 'Mantén la identidad usando las características visibles y continuidad temporal.';
    const languageInstruction = val(data,'language','es') === 'en' ? 'Write the entire report in English.' : 'Escribe todo el reporte en español natural.';

    const prompt = `Actúa como un entrenador de boxeo/kickboxing de alto nivel haciendo una revisión clínica post-sparring. ${languageInstruction}

VIDEO Y OBJETIVO:
- Disciplina: ${val(data,'sport','boxing')}.
- Guardia declarada del atleta: ${val(data,'stance','unknown')}.
- Peleador objetivo: ${descriptors || 'peleador seleccionado visualmente por el usuario'}.
- ${anchor}
- Si la identidad se vuelve dudosa, NO cambies de peleador silenciosamente: usa solo momentos en que estés seguro.

FOCO PEDIDO POR EL ATLETA:
- Áreas: ${val(data,'analysis_focus','technique,weaknesses,strategy')}.
- Objetivo personalizado: ${val(data,'custom_focus','ninguno adicional')}.

ESTÁNDAR DE COACHING:
1. No hagas comentarios genéricos. Busca patrones que se repitan y explica el contexto exacto.
2. Para cada prioridad conecta QUÉ sucede visualmente → POR QUÉ probablemente sucede → QUÉ consecuencia técnica/táctica produce → CÓMO corregirlo.
3. Distingue hechos visibles de hipótesis. No inventes conteos, porcentajes, velocidad, precisión ni estadísticas.
4. Revisa guardia/recuperación, base/balance, transferencia de peso, entradas, salidas, head movement, defensa después de combinaciones, distancia, timing, ángulos/pivotes, footwork, selección de golpes, ritmo, presión, reacción al jab, trabajo al cuerpo y decisiones bajo presión cuando sean visibles.
5. Lee al rival: rango, reacciones recurrentes, patrones defensivos/ofensivos, qué explota del atleta y qué vulnerabilidades ofrece. Convierte esa lectura en plan de revancha.
6. Prioriza SOLO 3 correcciones de mayor impacto. Deben ser específicas y desarrolladas.
7. Explica cómo explotar estratégicamente cada fortaleza.
8. Cada drill debe corresponder a una prioridad e incluir estructura práctica y objetivo técnico.
9. evidence usa timestamps MM:SS realmente visibles; 4–8 momentos distribuidos cuando el video lo permita. observation dice qué se ve y correction exactamente qué hacer distinto.
10. summary es diagnóstico de 4–7 frases: estilo, limitación principal, explotación del rival, fortaleza útil y cambio #1 para la próxima sesión.

Devuelve exclusivamente JSON válido con summary, strengths, priorities, opponent, plan, drills y evidence.`;

    const geminiProcessingMs = Date.now() - processingStartedAt;
    const analysisStartedAt = Date.now();
    updateJob?.('coaching');
    const parsed = await generateCoachJson(apiKey, prompt, fileUri, mimeType);
    const list = (value: unknown) => Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()) as string[] : [];
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.filter(x => x && typeof x === 'object').map(x => {
      const item = x as Record<string, unknown>;
      return { time: typeof item.time === 'string' ? item.time : '00:00', title: typeof item.title === 'string' ? item.title : 'Evidencia', observation: typeof item.observation === 'string' ? item.observation : '', correction: typeof item.correction === 'string' ? item.correction : '' };
    }).filter(x => /^\d{1,2}:\d{2}$/.test(x.time) && x.observation) : [];

    return {
      mode: 'real', provider: 'Gemini', usedInReport: true,
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Análisis completado con Gemini.',
      strengths: list(parsed.strengths), priorities: list(parsed.priorities).slice(0, 3), opponent: list(parsed.opponent),
      plan: list(parsed.plan), drills: list(parsed.drills), evidence,
      timings: {
        preprocessing_ms: 0,
        gemini_processing_ms: geminiProcessingMs,
        analysis_ms: Date.now() - analysisStartedAt,
        total_ms: Date.now() - startedAt,
        clip_count: 1,
      },
    };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json() as UploadedAnalysisRequest;
    if (new URL(req.url).searchParams.get('async') === '1') {
      const id = crypto.randomUUID();
      const job: AnalysisJob = { id, status: 'preparing', updatedAt: Date.now() };
      jobs.set(id, job);
      void completeAnalysis(data, (status) => {
        job.status = status;
        job.updatedAt = Date.now();
      }).then((report) => {
        job.status = 'complete'; job.report = report; job.updatedAt = Date.now();
      }).catch((error) => {
        console.error('Fight AI uploaded-file async analysis error', error);
        job.status = 'failed'; job.error = error instanceof Error ? error.message : 'No se pudo completar el análisis.'; job.updatedAt = Date.now();
      });
      return NextResponse.json({ id, status: job.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(await completeAnalysis(data));
  } catch (error) {
    console.error('Fight AI uploaded-file analysis error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar el análisis.' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id') || '';
  const job = jobs.get(id);
  if (!job) return NextResponse.json({ error: 'El trabajo no está disponible. Puedes reintentar sin volver a subir el video.' }, { status: 404 });
  if (job.status === 'complete' && job.report) return NextResponse.json({ status: job.status, report: job.report }, { headers: { 'Cache-Control': 'no-store' } });
  if (job.status === 'failed') return NextResponse.json({ status: job.status, error: job.error || 'No se pudo completar el análisis.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ status: job.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
