'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Evidence = { time: string; title: string; observation: string; correction: string };
type PipelineTimings = {
  upload_ms?: number; preprocessing_ms?: number; gemini_upload_ms?: number; gemini_processing_ms?: number; analysis_ms?: number; total_ms?: number;
  original_size_bytes?: number; processed_size_bytes?: number; clip_count?: number;
};
type Report = {
  mode: 'real' | 'demo'; provider: string; usedInReport: boolean; summary: string;
  strengths: string[]; priorities: string[]; opponent: string[]; plan: string[]; drills: string[]; evidence: Evidence[];
  timings?: PipelineTimings;
};
type Anchor = { x: number; y: number; size: number } | null;
type AnalysisContext = Record<string, string>;
type UploadedAnalysisSession = {
  fileName: string;
  fileUri: string;
  mimeType: string;
  context: AnalysisContext;
  timings: PipelineTimings;
};
type ServiceHealth = { geminiConfigured?: boolean; analysisReady?: boolean };

const focusOptions = [
  ['technique','Mejorar boxeo'], ['weaknesses','Detectar debilidades'], ['strategy','Analizar estrategia'],
  ['defense','Defensa'], ['offense','Ofensiva'], ['footwork','Footwork'], ['distance','Distancia / timing'],
] as const;

const demo: Report = {
  mode: 'demo', provider: 'Sin proveedor', usedInReport: false,
  summary: 'Tu presión funciona mejor cuando ocupas espacio con el jab antes de entrar. El patrón que más limita tu rendimiento es que el torso llega antes que la base: eso te deja disponible al contraataque y hace más lenta la salida. Prioridad: entrar con pasos cortos, terminar equilibrado y salir por ángulo.',
  strengths: ['Presión sostenida que obliga al rival a ceder terreno', 'Buena intención de cambio de nivel cuando anticipas la respuesta'],
  priorities: ['Entrada: el torso se adelanta a los pies en varias secuencias; corrige cerrando distancia con la base antes de soltar potencia.', 'Salida: después de atacar permaneces demasiado tiempo en la línea central; termina la combinación con pivote o paso lateral.', 'Guardia en recuperación: la mano derecha tarda en volver después de acciones ofensivas largas.'],
  opponent: ['El rival usa su mano adelantada cuando tiene espacio; quítale ese tiempo con finta + paso corto.', 'Bajo presión eleva la guardia y deja disponible el cuerpo; úsalo como reacción condicionada, no como ataque aislado.'],
  plan: ['Finta → paso corto → jab al pecho para ocupar línea.', 'Ataca máximo 2–3 golpes cuando la base no está asentada y termina con pivote.', 'Corta la salida lateral en vez de perseguir recto.'],
  drills: ['Step-jab + salida 45° · 3×2 min — objetivo: que pies y manos lleguen juntos.', 'Jab al pecho → cuerpo → pivote · 3×2 min — objetivo: crear reacción y salir fuera de línea.', 'Defensa tras combinación · 3×2 min — toda combinación termina con guardia + ángulo.'],
  evidence: [
    { time: '00:01', title: 'Entrada y base', observation: 'Momento de demostración para aprender a revisar la relación entre torso, base y distancia de entrada.', correction: 'Compara el avance de los pies con la posición del torso y evita proyectarte antes de cerrar distancia.' },
    { time: '00:03', title: 'Salida y recuperación', observation: 'Momento de demostración para revisar si el peleador queda frente a la línea de ataque después de su acción.', correction: 'Recupera guardia y añade un paso lateral o pivote como parte del final de la combinación.' },
  ],
};

const processingSteps = [
  { title: 'Subiendo video de forma segura', detail: 'Estamos enviando el archivo una sola vez. Mantén esta pestaña abierta.', typical: 'Suele tomar 15–60 s' },
  { title: 'Preparando video para IA', detail: 'Gemini está convirtiendo el video en una referencia lista para revisar.', typical: 'Suele tomar 30–90 s' },
  { title: 'Confirmando al peleador marcado', detail: 'Usamos tu marca, guantes y rasgos para mantener la misma identidad.', typical: 'En curso' },
  { title: 'Leyendo patrones técnicos', detail: 'El coach revisa distancia, defensa, base, salidas y decisiones repetidas.', typical: 'En curso' },
  { title: 'Analizando rival y estrategia', detail: 'Estamos conectando los momentos visibles con correcciones concretas.', typical: 'En curso' },
  { title: 'Construyendo tu reporte', detail: 'Ordenamos prioridades, drills, evidencia y las capturas para PDF.', typical: 'Último paso' },
];

function seconds(time: string) {
  const parts = time.split(':').map(Number);
  return parts.length === 2 ? (parts[0] || 0) * 60 + (parts[1] || 0) : Number(time) || 0;
}

function frameTarget(node: HTMLVideoElement) {
  const duration = Number.isFinite(node.duration) ? node.duration : 0;
  return duration > 0 ? Math.min(Math.max(duration * 0.035, 1), Math.min(5, Math.max(.1, duration - .2))) : 1;
}

async function captureFrame(src: string, at: number) {
  return new Promise<string>((resolve) => {
    const v = document.createElement('video');
    v.src = src; v.muted = true; v.preload = 'auto'; v.playsInline = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(v.videoWidth || 960, 960);
        canvas.height = Math.round(canvas.width * ((v.videoHeight || 540) / (v.videoWidth || 960)));
        canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .82));
      } catch { resolve(''); }
      v.removeAttribute('src'); v.load();
    };
    const seek = () => {
      const max = Number.isFinite(v.duration) && v.duration > .2 ? v.duration - .1 : Math.max(.1, at);
      try { v.currentTime = Math.min(Math.max(.1, at), max); } catch { finish(); }
    };
    v.addEventListener('loadeddata', seek, { once: true });
    v.addEventListener('seeked', () => window.setTimeout(finish, 120), { once: true });
    v.addEventListener('canplay', () => { if (v.currentTime > .05) window.setTimeout(finish, 100); }, { once: true });
    v.addEventListener('error', () => resolve(''), { once: true });
    window.setTimeout(() => { if (!settled && v.readyState >= 2) finish(); }, 5000);
  });
}

export default function Home() {
  const [video, setVideo] = useState<File | null>(null);
  const [sport, setSport] = useState<'boxing' | 'kickboxing'>('boxing');
  const [stance, setStance] = useState<'orthodox' | 'southpaw' | 'switch'>('orthodox');
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [gloveColor, setGloveColor] = useState('');
  const [topColor, setTopColor] = useState('');
  const [relativeHeight, setRelativeHeight] = useState('');
  const [build, setBuild] = useState('');
  const [fighterNotes, setFighterNotes] = useState('');
  const [anchor, setAnchor] = useState<Anchor>(null);
  const [marking, setMarking] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewAttempting, setPreviewAttempting] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [fallbackFrameUrl, setFallbackFrameUrl] = useState('');
  const [previewTime, setPreviewTime] = useState(0);
  const [focuses, setFocuses] = useState<string[]>(['technique','weaknesses','strategy']);
  const [customFocus, setCustomFocus] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stageFloor, setStageFloor] = useState(0);
  const [error, setError] = useState('');
  const [uploadedSession, setUploadedSession] = useState<UploadedAnalysisSession | null>(null);
  const [frames, setFrames] = useState<Record<string,string>>({});
  const [replayStatus, setReplayStatus] = useState('');
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  const videoUrl = useMemo(() => (video ? URL.createObjectURL(video) : ''), [video]);
  const reportVideoSrc = report?.mode === 'demo' ? '/api/demo-video' : videoUrl;
  const elapsedStage = elapsed < 20 ? 0 : elapsed < 70 ? 1 : elapsed < 115 ? 2 : elapsed < 165 ? 3 : elapsed < 220 ? 4 : 5;
  const processingStep = Math.min(processingSteps.length - 1, Math.max(stageFloor, elapsedStage));
  const elapsedLabel = elapsed < 60 ? `${elapsed}s transcurridos` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s transcurridos`;
  const waitGuidance = elapsed < 120
    ? 'Un sparring de 3 minutos suele requerir entre 2 y 5 minutos en total.'
    : elapsed < 300
      ? 'Seguimos trabajando. Los videos HEVC o de mayor duración pueden tardar algunos minutos más.'
      : 'El análisis sigue activo. No necesitas volver a subir el video; puedes mantener esta pestaña abierta.';
  const identityReady = Boolean(anchor || gloveColor || topColor || fighterNotes.trim());
  const workflowStep = report || busy ? 5 : !video ? 1 : !anchor ? 2 : !identityReady ? 3 : 4;

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => { void fetch('/api/health', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setServiceHealth).catch(() => setServiceHealth({})); }, []);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!report || !reportVideoSrc || !report.evidence.length) return;
    let cancelled = false;
    (async () => {
      const next: Record<string,string> = {};
      if (!fallbackFrameUrl) {
        for (const e of report.evidence) next[e.time] = await captureFrame(reportVideoSrc, seconds(e.time));
      }
      const missing = report.evidence.filter((e) => !next[e.time]);
      // HEVC Main 10 and some phone codecs cannot be painted by Chrome. Ask
      // FFmpeg for the exact report timestamps so printed PDF evidence stays real.
      if (missing.length && video && report.mode === 'real') {
        try {
          const response = await fetch(`/api/evidence-frames?times=${encodeURIComponent(missing.map((e) => seconds(e.time)).join(','))}`, {
            method: 'POST', headers: { 'Content-Type': video.type || 'video/mp4' }, body: video,
          });
          const data = response.ok ? await response.json() as { frames?: Record<string,string> } : null;
          for (const evidence of missing) {
            const frame = data?.frames?.[String(seconds(evidence.time))];
            if (frame) next[evidence.time] = frame;
          }
        } catch { /* The report remains truthful and shows a pending capture. */ }
      }
      if (!cancelled) setFrames(next);
    })();
    return () => { cancelled = true; };
  }, [report, reportVideoSrc, video, fallbackFrameUrl]);

  function selectVideo(file: File | null) {
    if (fallbackFrameUrl) URL.revokeObjectURL(fallbackFrameUrl);
    setVideo(file); setReport(null); setFrames({}); setAnchor(null); setMarking(false); setPreviewReady(false); setPreviewAttempting(false); setPreviewError(''); setFallbackFrameUrl(''); setPreviewTime(0); setError(''); setReplayStatus(''); setUploadedSession(null);
  }
  function showDemo() { setFrames({}); setReport(demo); window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
  function toggleFocus(id: string) { setFocuses(x => x.includes(id) ? x.filter(v => v !== id) : [...x, id]); }
  async function requestCompatibleFrame() {
    if (!video) return false;
    const target = videoRef.current ? frameTarget(videoRef.current) : 2;
    const response = await fetch(`/api/preview-frame?time=${encodeURIComponent(target.toFixed(2))}`, {
      method: 'POST', headers: { 'Content-Type': video.type || 'video/mp4' }, body: video,
    });
    if (!response.ok) return false;
    const frame = await response.blob();
    if (!frame.size || !frame.type.startsWith('image/')) return false;
    if (fallbackFrameUrl) URL.revokeObjectURL(fallbackFrameUrl);
    setFallbackFrameUrl(URL.createObjectURL(frame));
    setPreviewReady(true); setPreviewTime(target);
    return true;
  }
  async function generateCompatibleFrame() {
    setPreviewAttempting(true); setPreviewError('Generando un frame compatible para este formato de video…');
    try {
      if (await requestCompatibleFrame()) return true;
      setPreviewReady(false); setPreviewError('No fue posible generar un frame compatible. Puedes identificar al atleta con sus características y continuar con el análisis.');
      return false;
    } catch {
      setPreviewReady(false); setPreviewError('No fue posible generar un frame compatible. Puedes identificar al atleta con sus características y continuar con el análisis.');
      return false;
    } finally { setPreviewAttempting(false); }
  }
  async function decodePreview(node = videoRef.current, allowCompatibleFrame = true): Promise<boolean> {
    if (!node) return false;
    setPreviewAttempting(true); setPreviewError(''); node.muted = true;
    const target = frameTarget(node);
    const decoded = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ready: boolean) => {
        if (settled) return;
        settled = true; window.clearTimeout(timeout); node.pause();
        ['loadeddata', 'canplay', 'seeked', 'timeupdate', 'playing'].forEach(event => node.removeEventListener(event, check));
        resolve(ready);
      };
      const check = () => {
        if (node.readyState >= 2 && node.videoWidth > 0 && node.videoHeight > 0 && node.currentTime > .05) finish(true);
      };
      const timeout = window.setTimeout(() => finish(false), 9_000);
      ['loadeddata', 'canplay', 'seeked', 'timeupdate', 'playing'].forEach(event => node.addEventListener(event, check));
      try { if (node.currentTime < .05) node.currentTime = target; } catch { /* play can still request a decoded frame */ }
      void node.play().catch(() => check());
      check();
    });
    if (decoded) { setPreviewAttempting(false); setPreviewReady(true); setPreviewTime(node.currentTime || target); return true; }
    if (allowCompatibleFrame) {
      setPreviewError('Generando un frame compatible para este formato de video…');
      try { if (await requestCompatibleFrame()) { setPreviewAttempting(false); return true; } } catch { /* keep the local decode error below */ }
    }
    setPreviewAttempting(false);
    setPreviewReady(false);
    setPreviewError(allowCompatibleFrame
      ? 'No fue posible generar un frame compatible. Puedes identificar al atleta con sus características y continuar con el análisis.'
      : 'Tu navegador no pudo mostrar este frame. Usa “Generar frame compatible” para crear una imagen seleccionable.');
    return false;
  }
  async function toggleMarking() {
    const node = videoRef.current;
    if (node && !(previewReady || await decodePreview(node, true))) return;
    setMarking(x => !x);
  }
  function setAnchorFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ x: ((e.clientX-r.left)/r.width)*100, y: ((e.clientY-r.top)/r.height)*100, size: anchor?.size || 24 });
    setMarking(false);
    setPreviewTime(videoRef.current?.currentTime || previewTime);
  }

  async function parseResponse(response: Response) {
    const raw = await response.text();
    let data: Report | { error?: string } | null = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) {
      const serverMessage = data && 'error' in data && typeof data.error === 'string' ? data.error : '';
      throw new Error(serverMessage || `El análisis terminó con HTTP ${response.status}.`);
    }
    if (!data || !('summary' in data)) throw new Error('El servidor respondió sin un reporte válido.');
    return data;
  }

  async function requestUploadedAnalysis(session: UploadedAnalysisSession) {
    const started = await fetch('/api/analyze-uploaded?async=1', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...session.context, fileName: session.fileName, fileUri: session.fileUri, mimeType: session.mimeType }),
    });
    const startData = await parseResponse(started) as { id?: string };
    if (!startData.id) throw new Error('No se pudo iniciar el trabajo de análisis.');
    for (;;) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const statusResponse = await fetch(`/api/analyze-uploaded?id=${encodeURIComponent(startData.id)}`, { cache: 'no-store' });
      const raw = await statusResponse.text();
      let data: { status?: string; report?: Report; error?: string } | null = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (data?.status === 'complete' && data.report) return data.report;
      if (data?.status === 'failed' || !statusResponse.ok && statusResponse.status !== 202) throw new Error(data?.error || 'No se pudo completar el análisis.');
      if (data?.status === 'coaching') setStageFloor(3);
      else setStageFloor(1);
    }
  }

  async function analyze() {
    if (!video) return setError('Selecciona un video antes de analizar.');
    if (!anchor && !gloveColor && !topColor && !fighterNotes.trim()) return setError('Marca al peleador o agrega características para poder seguirlo durante el video.');
    setBusy(true); setStageFloor(0); setError(''); setReport(null); setFrames({});
    try {
      let directSession: UploadedAnalysisSession | null = null;
      const context: AnalysisContext = {
        language, sport, stance, athlete_marker: anchor ? 'visual_anchor' : 'visual_reid',
        glove_color: gloveColor, top_color: topColor, relative_height: relativeHeight, build, fighter_notes: fighterNotes,
        analysis_focus: focuses.join(','), custom_focus: customFocus,
        anchor_x: anchor ? anchor.x.toFixed(2) : '', anchor_y: anchor ? anchor.y.toFixed(2) : '',
        anchor_size: anchor ? anchor.size.toFixed(2) : '', anchor_time: anchor ? previewTime.toFixed(2) : '',
      };
      const healthResponse = await fetch('/api/health', { cache: 'no-store' });
      const health = healthResponse.ok ? await healthResponse.json() as { backendConfigured?: boolean } : {};
      let response: Response;
      if (health.backendConfigured) {
        const body = new FormData(); body.append('video', video);
        for (const [key, value] of Object.entries(context)) body.append(key, value);
        response = await fetch('/api/analyze', { method: 'POST', body });
      } else {
        const uploadStarted = performance.now();
        const uploadedResponse = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': video.type || 'video/mp4', 'x-fight-ai-name': encodeURIComponent(video.name || 'fight-ai-sparring.mp4'), 'x-fight-ai-size': String(video.size) }, body: video });
        const uploadedRaw = await uploadedResponse.text();
        let uploaded: { fileName?: string; fileUri?: string; mimeType?: string; error?: string } | null = null;
        try { uploaded = uploadedRaw ? JSON.parse(uploadedRaw) : null; } catch { uploaded = null; }
        if (!uploadedResponse.ok || !uploaded?.fileName || !uploaded.fileUri) throw new Error(uploaded?.error || `La carga del video terminó con HTTP ${uploadedResponse.status}.`);
        const session: UploadedAnalysisSession = {
          context, fileName: uploaded.fileName, fileUri: uploaded.fileUri, mimeType: uploaded.mimeType || video.type || 'video/mp4',
          timings: { upload_ms: Math.round(performance.now() - uploadStarted), original_size_bytes: video.size, processed_size_bytes: video.size, clip_count: 1 },
        };
        directSession = session;
        setUploadedSession(session);
        setStageFloor(1);
        const data = await requestUploadedAnalysis(session);
        setStageFloor(5); setReport({ ...data, timings: { ...data.timings, ...directSession?.timings } }); setUploadedSession(null);
        window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        return;
      }
      const data = await parseResponse(response); setStageFloor(5); setReport(data); setUploadedSession(null);
      window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); }
    finally { setBusy(false); }
  }

  async function retryUploadedAnalysis() {
    if (!uploadedSession) return;
    setBusy(true); setStageFloor(1); setError(''); setReport(null); setFrames({});
    try {
      const data = await requestUploadedAnalysis(uploadedSession);
      setStageFloor(5); setReport({ ...data, timings: { ...data.timings, ...uploadedSession.timings } }); setUploadedSession(null);
      window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); }
    finally { setBusy(false); }
  }

  function jumpMainPreview(time: string) {
    const node = videoRef.current; if (!node) return;
    const target = seconds(time); setReplayStatus(`Evidencia ${time} lista en el reproductor principal.`);
    const seek = () => {
      node.pause();
      const max = Number.isFinite(node.duration) && node.duration > .2 ? node.duration - .08 : target;
      node.currentTime = Math.min(Math.max(.08, target), max);
      node.addEventListener('seeked', () => node.play().catch(() => undefined), { once: true });
    };
    if (node.readyState < 2) node.addEventListener('loadeddata', seek, { once: true }); else seek();
  }

  return <main>
    <header className="topbar"><a className="brand" href="#top"><span className="mark">FA</span><div><b>FIGHT AI</b><small>SPARRING ANALYST</small></div></a><nav className="topnav"><a href="#analyze">Analizar</a><a href="#report">Reporte</a><a href="#visual-coach">Visual Coach</a></nav><div className={`status ${serviceHealth?.geminiConfigured && serviceHealth?.analysisReady ? 'ready' : serviceHealth ? 'offline' : ''}`}><span className="dot"/>{serviceHealth === null ? ' VERIFICANDO GEMINI…' : serviceHealth.geminiConfigured && serviceHealth.analysisReady ? ' GEMINI LISTO PARA ANALIZAR' : ' GEMINI NO DISPONIBLE'}</div></header>
    <section className="hero" id="top"><div><span className="eyebrow">BOXING · KICKBOXING · COACHING CON EVIDENCIA</span><h1>Tu sparring,<br/><em>convertido en un plan.</em></h1><p>Marca al peleador, define el foco y recibe un plan de combate basado en momentos verificables del video.</p><div className="startDirection"><span>01</span><div><b>COMIENZA SUBIENDO TU VIDEO</b><small>La zona destacada de abajo es el único primer paso.</small></div><i>↓</i></div></div><div className="heroCard"><span className="heroMetric">01</span><b>COACHING QUE PUEDES REVISAR</b><p>Patrón visible → consecuencia → corrección → drill → evidencia reproducible.</p><div className="miniProvider"><span>PRIVADO</span><strong>Tu video se usa sólo para este análisis.</strong></div><div className="miniProvider"><span>HONESTO</span><strong>Sin conteos ni métricas inventadas.</strong></div></div></section>
    <section className="workflowStrip" aria-label="Progreso del análisis">{['Video','Marcar peleador','Características','Foco del coach','Reporte'].map((label,index)=><span key={label} className={workflowStep===index+1?'active':workflowStep>index+1?'done':''}><i>{workflowStep>index+1?'✓':index+1}</i>{label}</span>)}</section>
    <section className="workspace" id="analyze"><aside className="panel uploadPanel">
      <SectionTitle n="01" title="VIDEO" subtitle="Selecciona y revisa tu sparring" />
      <input data-testid="video-input" ref={inputRef} hidden type="file" accept="video/*" onChange={e => selectVideo(e.target.files?.[0] || null)} />
      {!video ? <button className="drop" data-testid="upload-button" onClick={() => inputRef.current?.click()}><span className="dropKicker">PASO 1 · COMIENZA AQUÍ</span><span className="uploadIcon">↑</span><strong>SUBE EL VIDEO DE TU SPARRING</strong><span className="dropCopy">Arrastra tu video aquí o selecciónalo desde tu teléfono</span><small>MP4, MOV o formato compatible</small><span className="dropAction">ELEGIR VIDEO <b>→</b></span></button> : <div className="videoWrap"><div className="videoTask"><span>PASO 2 · IDENTIFICA A TU ATLETA</span><b>{previewReady?'Frame listo para marcar':'Preparando un frame verificable'}</b></div><div className={`videoStage ${marking?'isMarking':''}`}>{fallbackFrameUrl ? <img data-testid="compatible-frame" className="compatibleFrame" src={fallbackFrameUrl} alt="Frame compatible para marcar al peleador"/> : <video data-testid="video-preview" ref={videoRef} src={videoUrl} controls={!marking} playsInline muted preload="auto" onLoadedMetadata={e=>void decodePreview(e.currentTarget)}/>} {anchor && <div className="fighterCircle" style={{left:`${anchor.x}%`,top:`${anchor.y}%`,width:`${anchor.size}%`,aspectRatio:'1'}}/>}{marking && <div className="markerOverlay" data-testid="marker-overlay" onClick={setAnchorFromEvent}><span>Haz clic sobre el centro del peleador</span></div>}</div><div className="previewHint" data-testid="preview-status"><b>{previewReady?'FRAME VISIBLE LISTO':previewAttempting?'PREPARANDO FRAME COMPATIBLE…':'FRAME NO DISPONIBLE'}</b><span>{previewReady?'Busca el momento más claro con la barra y luego marca al atleta.':previewError}</span>{!previewReady && <button data-testid="decode-frame" onClick={()=>void generateCompatibleFrame()} disabled={previewAttempting}>{previewAttempting?'GENERANDO FRAME…':'REINTENTAR FRAME COMPATIBLE'}</button>}</div><div className="fileRow"><div><b>{video.name}</b><span>{(video.size/1024/1024).toFixed(1)} MB</span></div><button onClick={() => inputRef.current?.click()}>Cambiar</button></div>{replayStatus && <div className="replayStatus">▶ {replayStatus}</div>}</div>}
      <SectionTitle n="02" title="SELECCIONA AL PELEADOR" subtitle="Pausa en un frame claro y circula al peleador como en Android" extraClass="fighterTitle" />
      <div className="anchorControls"><button data-testid="mark-fighter" className={marking?'active':''} disabled={!video} onClick={toggleMarking}>{anchor?'AJUSTAR CÍRCULO':'MARCAR PELEADOR'}</button>{anchor && <button onClick={()=>setAnchor(null)}>Limpiar</button>}</div>
      {anchor && <><div className="anchorConfirmed">✓ Peleador marcado en {Math.floor(previewTime/60)}:{String(Math.floor(previewTime%60)).padStart(2,'0')}</div><label className="rangeLabel">Tamaño del círculo<input type="range" min="12" max="48" value={anchor.size} onChange={e=>setAnchor({...anchor,size:Number(e.target.value)})}/></label></>}
      <SectionTitle n="03" title="CARACTERÍSTICAS" subtitle="Ayuda al motor a mantener la identidad" extraClass="optionsTitle" />
      <div className="identityGrid"><label>Color de guantes<input data-testid="glove-color" value={gloveColor} onChange={e=>setGloveColor(e.target.value)} placeholder="Ej. rojos"/></label><label>Ropa / polera<input value={topColor} onChange={e=>setTopColor(e.target.value)} placeholder="Ej. polera negra"/></label><label>Altura relativa<select value={relativeHeight} onChange={e=>setRelativeHeight(e.target.value)}><option value="">No sé</option><option value="shorter">Más bajo</option><option value="similar">Similar</option><option value="taller">Más alto</option></select></label><label>Contextura<select value={build} onChange={e=>setBuild(e.target.value)}><option value="">No sé</option><option value="slim">Delgada</option><option value="medium">Media / atlética</option><option value="stocky">Robusta</option></select></label><label className="wide">Otras características<textarea data-testid="fighter-notes" value={fighterNotes} onChange={e=>setFighterNotes(e.target.value)} placeholder="Ej. más bajo, pelo corto, shorts negros, protector rojo…"/></label></div>
      <SectionTitle n="04" title="FOCO DEL COACH" subtitle="Dile qué quieres que priorice" extraClass="optionsTitle" />
      <div className="focusGrid">{focusOptions.map(([id,label])=><button data-testid={`focus-${id}`} key={id} className={focuses.includes(id)?'active':''} onClick={()=>toggleFocus(id)}>{focuses.includes(id)?'✓ ':''}{label}</button>)}</div>
      <label className="customFocus">Objetivo personalizado<textarea value={customFocus} onChange={e=>setCustomFocus(e.target.value)} placeholder="Ej. quiero saber por qué me conectan al entrar, cómo cerrar mejor la distancia y qué estrategia usar contra este rival."/></label>
      <SectionTitle n="05" title="CONFIGURACIÓN" subtitle="Contexto del análisis" extraClass="optionsTitle" />
      <div className="analysisOptions"><label>Disciplina<select data-testid="sport-select" value={sport} onChange={e=>setSport(e.target.value as 'boxing'|'kickboxing')}><option value="boxing">Boxeo</option><option value="kickboxing">Kickboxing</option></select></label><label>Guardia<select data-testid="stance-select" value={stance} onChange={e=>setStance(e.target.value as 'orthodox'|'southpaw'|'switch')}><option value="orthodox">Ortodoxa</option><option value="southpaw">Zurda</option><option value="switch">Switch</option></select></label><label>Idioma<select value={language} onChange={e=>setLanguage(e.target.value as 'es'|'en')}><option value="es">Español</option><option value="en">English</option></select></label></div>
      <div className="analysisTiming"><b>TIEMPO ESTIMADO</b><span>Un sparring de 3 min suele tardar 2–5 min. Los videos largos o HEVC pueden demorar más.</span></div>
      <button data-testid="analyze-button" className="primary" disabled={busy||!video} onClick={analyze}>{busy?'ANALIZANDO SPARRING…':'ANALIZAR SPARRING'}<span>→</span></button>
      {busy && <div className="processingCard" data-testid="processing-state" role="status" aria-live="polite"><div className="spinner"/><div><div className="processingMeta"><b>TRABAJANDO · {processingSteps[processingStep].typical}</b><time>{elapsedLabel}</time></div><strong>{processingSteps[processingStep].title}</strong><span>{processingSteps[processingStep].detail} {waitGuidance}</span></div><div className="processTrack">{processingSteps.map((_,i)=><i key={i} className={i<=processingStep?'done':''}/>)}</div></div>}
      {error && <div className="error" role="alert"><b>No pudimos terminar el análisis</b><span>{error}</span>{uploadedSession && !busy && <button data-testid="retry-uploaded-analysis" onClick={retryUploadedAnalysis}>REINTENTAR ANÁLISIS SIN VOLVER A SUBIR</button>}</div>}
    </aside>
    <section className="panel reportPanel" id="report" ref={reportRef} data-testid="report-panel">{!report?<div className="empty"><span>REPORTE DE COACHING</span><div className="emptyRing">◎</div><h2>Un plan claro para tu próxima sesión</h2><p>Sube el round, identifica a tu atleta y recibe tres prioridades con evidencia que puedes volver a reproducir.</p><div className="emptyTags"><span>01 · MOMENTOS VISIBLES</span><span>02 · CORRECCIONES CONCRETAS</span><span>03 · DRILLS Y PLAN VS RIVAL</span></div><div className="pdfPreview">↓ TU REPORTE INCLUIRÁ DESCARGA PDF</div><button data-testid="demo-report-button" className="emptyDemo" onClick={showDemo}>EXPLORAR REPORTE DEMO →</button></div>:<ReportView report={report} onJumpMain={jumpMainPreview} frames={frames} mediaSrc={reportVideoSrc} sourceNeedsFrames={Boolean(fallbackFrameUrl)}/>}</section></section>
    <footer>Fight AI · Herramienta de apoyo técnico. La decisión final pertenece al atleta y su entrenador.</footer>
  </main>;
}

function SectionTitle({n,title,subtitle,extraClass=''}:{n:string;title:string;subtitle:string;extraClass?:string}) { return <div className={`sectionTitle ${extraClass}`}><span>{n}</span><div><b>{title}</b><small>{subtitle}</small></div></div>; }

function ReportView({report,onJumpMain,frames,mediaSrc,sourceNeedsFrames}:{report:Report;onJumpMain:(time:string)=>void;frames:Record<string,string>;mediaSrc:string;sourceNeedsFrames:boolean}) {
  const footworkIssue = report.priorities.some(x=>/foot|pie|pies|base|piv|ángulo|distancia|entrada|salida/i.test(x));
  const evidenceFramesReady = report.evidence.every((e) => Boolean(frames[e.time]));
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(report.evidence[0] || null);
  const evidenceVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { setSelectedEvidence(report.evidence[0] || null); }, [report]);
  function playEvidence(e: Evidence) {
    setSelectedEvidence(e);
    if (sourceNeedsFrames) return;
    const node = evidenceVideoRef.current;
    if (node && mediaSrc) {
      const target = seconds(e.time);
      const seek = () => {
        node.pause(); const max = Number.isFinite(node.duration) && node.duration > .2 ? node.duration - .08 : target;
        node.currentTime = Math.min(Math.max(.08, target), max);
        node.addEventListener('seeked', () => window.setTimeout(() => node.play().catch(() => undefined), 80), { once: true });
      };
      if (node.readyState < 2) node.addEventListener('loadeddata', seek, { once: true }); else seek();
    }
    if (report.mode === 'real') onJumpMain(e.time);
  }
  return <div data-testid="report-content">
    <div className="reportHead"><div><span className="eyebrow">REPORTE DE COACHING</span><h2>Análisis técnico</h2><small>{report.mode==='demo'?'Vista demo interactiva · incluye video, evidencia y diagramas':'Análisis completado'}</small>{report.timings && <small data-testid="pipeline-timings">Carga {formatMs(report.timings.upload_ms)} · Preparación Gemini {formatMs(report.timings.gemini_processing_ms)} · Coaching {formatMs(report.timings.analysis_ms)} · Total servidor {formatMs(report.timings.total_ms)}</small>}</div><div className="reportActions"><div data-testid="provider-badge" className={report.usedInReport?'aiBadge on':'aiBadge'}><span className="dot"/>{report.usedInReport?`${report.provider.toUpperCase()} · SÍ PARTICIPÓ EN ESTE REPORTE`:`${report.provider.toUpperCase()} · NO PARTICIPÓ`}</div>{!evidenceFramesReady && <small className="pdfFrameStatus" role="status">PREPARANDO IMÁGENES PARA PDF · {Object.keys(frames).length}/{report.evidence.length}</small>}<button data-testid="print-report" disabled={!evidenceFramesReady} title={evidenceFramesReady ? 'Descargar reporte con imágenes reales' : 'Esperando las capturas reales del video'} onClick={()=>window.print()}>{evidenceFramesReady?'↓ DESCARGAR PDF':'⌛ PREPARANDO PDF'}</button></div></div>
    {report.mode === 'demo' && <section className="demoVideoSection" data-testid="demo-video-section"><div><span className="eyebrow">VIDEO DE DEMOSTRACIÓN</span><h3>Prueba cómo funciona la evidencia antes de subir tu sparring</h3><p>Este clip corto demuestra selección, timestamps y reproducción. El reporte de ejemplo no afirma que sea un análisis real de este clip.</p></div><video data-testid="demo-video" src="/api/demo-video" controls muted playsInline preload="auto"/></section>}
    <div className="takeaway"><span>DIAGNÓSTICO PRINCIPAL</span><p>{report.summary}</p></div>
    <div className="reportNav"><a href="#priorities">Prioridades</a><a href="#opponent">Rival</a><a href="#visual-coach">Visual Coach</a><a href="#evidence">Evidencia</a></div>
    <div className="grid3"><Card title="FORTALEZAS QUE DEBES CONSERVAR" items={report.strengths} tone="good"/><Card title="PRIORIDADES CLÍNICAS" items={report.priorities} tone="focus" id="priorities"/><Card title="LECTURA DEL RIVAL" items={report.opponent} tone="neutral" id="opponent"/></div>
    <div className="strategy"><div><h3>PLAN TÁCTICO</h3>{report.plan.map((x,i)=><p key={x+i}><b>0{i+1}</b><span>{x}</span></p>)}</div><div><h3>DRILLS PRESCRITOS</h3>{report.drills.map((x,i)=><p key={x+i}><b>0{i+1}</b><span>{x}</span></p>)}</div></div>
    <section className="visualCoach" id="visual-coach"><div><span className="eyebrow">VISUAL COACH</span><h3>Corrección ligada al problema detectado</h3><p>{report.priorities[0]||'Mantén una base recuperable antes de atacar.'}</p></div><div className="coachDiagram"><span className="fighterDot">TÚ</span><i className="lineArrow">→</i><span className="targetDot">RIVAL</span><b>ENTRA CON BASE · TERMINA EQUILIBRADO · SAL POR ÁNGULO ↗</b></div></section>
    <section className="printDiagrams" data-testid="printable-diagrams"><div className="lessonHead"><span className="eyebrow">DIAGRAMAS DEL COACH · INCLUIDOS EN PDF</span><h3>Tres referencias visuales para llevar al entrenamiento</h3></div><div className="diagramGrid"><TechniqueDiagram kind="entry" title="1 · Entrada con base"/><TechniqueDiagram kind="guard" title="2 · Recupera guardia"/><TechniqueDiagram kind="pivot" title="3 · Sal por ángulo"/></div></section>
    <section className="lessonSection"><div className="lessonHead"><span className="eyebrow">VIDEOS DE CORRECCIÓN</span><h3>{footworkIssue?'Footwork, pivote y salidas':'Fundamentos aplicables a tu prioridad principal'}</h3></div><div className="lessonGrid"><article><iframe src="https://www.youtube.com/embed/-OK0kpv58Rk" title="Cómo mejorar footwork de boxeo" allowFullScreen/><b>Footwork: cómo corregirlo</b><span>Tony Jeffries · usa este video para comparar base, desplazamiento y pies demasiado abiertos.</span></article><article><iframe src="https://www.youtube.com/embed/hNclexRmDsY" title="Cómo pivotar en boxeo" allowFullScreen/><b>Pivote y salida por ángulo</b><span>Tony Jeffries · referencia visual para no quedar frente al rival después de atacar.</span></article></div></section>
    <h3 className="evidenceTitle" id="evidence">EVIDENCIA REPRODUCIBLE <span>{report.evidence.length} momentos</span></h3>
    {mediaSrc && selectedEvidence && <section className="evidenceViewer" data-testid="evidence-viewer"><div className="evidencePlayer">{sourceNeedsFrames ? (frames[selectedEvidence.time] ? <img data-testid="evidence-compatible-frame" src={frames[selectedEvidence.time]} alt={`Captura real del video en ${selectedEvidence.time}`}/> : <div className="evidenceFrameLoading">PREPARANDO<br/>CAPTURA REAL</div>) : <video key={mediaSrc} data-testid="evidence-video" ref={evidenceVideoRef} src={mediaSrc} controls muted playsInline preload="auto" poster={frames[selectedEvidence.time] || undefined}/>}</div><div><span className="eyebrow">MOMENTO SELECCIONADO · {selectedEvidence.time}</span><h3>{selectedEvidence.title}</h3><p>{sourceNeedsFrames && <span className="evidenceCompatibilityNote">Tu navegador no puede reproducir este códec; mostramos una captura JPEG real del mismo momento. </span>}{selectedEvidence.observation}</p><small><strong>CORRECCIÓN</strong>{selectedEvidence.correction}</small>{!sourceNeedsFrames && <button data-testid="replay-selected" onClick={()=>playEvidence(selectedEvidence)}>▶ REPRODUCIR DESDE {selectedEvidence.time}</button>}</div></section>}
    <div className="evidence">{report.evidence.length?report.evidence.map((e,i)=><button data-testid="evidence-item" key={`${i}-${e.time}`} className={selectedEvidence?.time===e.time?'selected':''} onClick={()=>playEvidence(e)}>{frames[e.time]?<img src={frames[e.time]} alt={`Captura del sparring en ${e.time}`}/>:<div className="framePlaceholder">CAPTURA<br/>PREPARANDO</div>}<time>{e.time}</time><div><b>{e.title}</b><span>{e.observation}</span><small><strong>CORRECCIÓN</strong>{e.correction}</small></div><em>▶</em></button>):<div className="noEvidence">Este reporte no devolvió timestamps verificables. Fight AI no inventa evidencia.</div>}</div>
  </div>;
}

function TechniqueDiagram({kind,title}:{kind:'entry'|'guard'|'pivot';title:string}) {
  return <article className="techniqueDiagram"><b>{title}</b><svg viewBox="0 0 240 150" role="img" aria-label={title}>
    <rect x="1" y="1" width="238" height="148" rx="8" fill="none" stroke="currentColor" opacity=".2"/>
    {kind==='entry' && <><circle cx="62" cy="69" r="15" fill="none" stroke="currentColor" strokeWidth="3"/><line x1="62" y1="84" x2="62" y2="112" stroke="currentColor" strokeWidth="3"/><line x1="45" y1="112" x2="77" y2="112" stroke="currentColor" strokeWidth="4"/><circle cx="184" cy="69" r="15" fill="none" stroke="currentColor" strokeWidth="3"/><line x1="184" y1="84" x2="184" y2="112" stroke="currentColor" strokeWidth="3"/><path d="M82 100 C108 97 128 97 151 96" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M142 87 L156 96 L142 105" fill="none" stroke="currentColor" strokeWidth="4"/><text x="76" y="132" fontSize="11" fill="currentColor">pies primero → golpe</text></>}
    {kind==='guard' && <><circle cx="120" cy="50" r="17" fill="none" stroke="currentColor" strokeWidth="3"/><line x1="120" y1="67" x2="120" y2="112" stroke="currentColor" strokeWidth="3"/><path d="M118 76 L93 56 M122 76 L147 56" stroke="currentColor" strokeWidth="5"/><circle cx="90" cy="53" r="6" fill="none" stroke="currentColor" strokeWidth="3"/><circle cx="150" cy="53" r="6" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M79 45 C86 31 97 25 109 24 M161 45 C154 31 143 25 131 24" fill="none" stroke="currentColor" strokeWidth="3"/><text x="73" y="132" fontSize="11" fill="currentColor">manos vuelven a casa</text></>}
    {kind==='pivot' && <><circle cx="104" cy="73" r="17" fill="none" stroke="currentColor" strokeWidth="3"/><circle cx="177" cy="73" r="17" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M104 108 C75 108 55 91 55 68 C55 43 78 27 103 29" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="7 5"/><path d="M94 19 L107 29 L93 38" fill="none" stroke="currentColor" strokeWidth="4"/><line x1="121" y1="73" x2="159" y2="73" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/><text x="60" y="132" fontSize="11" fill="currentColor">sal de la línea central ↗</text></>}
  </svg><span>{kind==='entry'?'La base cierra distancia antes de proyectar el torso.':kind==='guard'?'Toda combinación termina con manos recuperadas y postura lista.':'El último golpe conecta con un pivote o paso lateral inmediato.'}</span></article>;
}

function Card({title,items,tone,id}:{title:string;items:string[];tone:'good'|'focus'|'neutral';id?:string}) { return <div className={`card ${tone}`} id={id}><h3>{title}</h3>{items.length?items.map((x,i)=><p key={`${i}-${x}`}><span>{String(i+1).padStart(2,'0')}</span>{x}</p>):<p className="muted">Sin hallazgos adicionales.</p>}</div>; }

function formatMs(value?: number) { return typeof value === 'number' ? `${(value / 1000).toFixed(value >= 60_000 ? 0 : 1)} s` : 'no medido'; }
