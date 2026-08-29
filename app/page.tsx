'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Evidence = { time: string; title: string; observation: string; correction: string };
type Report = {
  mode: 'real' | 'demo'; provider: string; usedInReport: boolean; summary: string;
  strengths: string[]; priorities: string[]; opponent: string[]; plan: string[]; drills: string[]; evidence: Evidence[];
};

type FighterChoice = { id: string; label: string; hint: string; color?: string; marker: string };

const fighters: FighterChoice[] = [
  { id: 'red', label: 'Guantes rojos', hint: 'Ancla visual principal', color: '#ef5350', marker: 'red_gloves' },
  { id: 'blue', label: 'Guantes azules', hint: 'Ancla visual alternativa', color: '#42a5f5', marker: 'blue_gloves' },
  { id: 'other', label: 'Otro peleador', hint: 'Re-identificación visual', marker: 'visual_reid' },
];

const demo: Report = {
  mode: 'demo', provider: 'Sin proveedor', usedInReport: false,
  summary: 'Presionas con intención y obligas al rival a retroceder, pero tus mejores entradas aparecen cuando primero ocupas espacio con jab o finta. La prioridad es llegar con los pies antes de comprometer el torso.',
  strengths: ['Presión sostenida con intención', 'Cambios de nivel para salir de la línea', 'Capacidad de llevar al rival hacia atrás'],
  priorities: ['Preparar las entradas antes de cerrar distancia', 'Acercar los pies antes de comprometer el torso', 'Recuperar una base compacta después del cambio de nivel'],
  opponent: ['La mano adelantada gana valor cuando tiene espacio', 'Bajo presión tiende a elevar la guardia', 'Su salida lateral debe cortarse en vez de perseguirse en línea'],
  plan: ['Finta → parry/slip → paso corto', 'Doble jab o jab al pecho → cuerpo → cabeza', 'Cerrar la salida lateral y terminar con pivote'],
  drills: ['Doble jab + cuerpo + pivote · 3×2 min', 'Parry/slip + respuesta de máximo 2 golpes + salida · 3×2 min', 'Cortar ring sin perseguir en línea · 3×2 min'],
  evidence: [
    { time: '00:34', title: 'Entrada desde distancia larga', observation: 'La línea central queda disponible mientras el rival puede usar su mano adelantada.', correction: 'Finta o defensa de jab antes de ganar el paso.' },
    { time: '00:52', title: 'Torso por delante de la base', observation: 'La intención de potencia aparece antes de que los pies terminen de cerrar distancia.', correction: 'Primero acercar la base; después lanzar desde una posición recuperable.' },
    { time: '01:17', title: 'Base muy abierta tras cambio de nivel', observation: 'La idea defensiva saca la cabeza de línea, pero la postura tarda en recuperarse.', correction: 'Recoger los pies y salir por ángulo inmediatamente.' },
  ],
};

const processingSteps = ['Subiendo video', 'Identificando peleador', 'Leyendo patrones', 'Construyendo coaching'];

export default function Home() {
  const [video, setVideo] = useState<File | null>(null);
  const [fighterId, setFighterId] = useState('red');
  const [sport, setSport] = useState<'boxing' | 'kickboxing'>('boxing');
  const [stance, setStance] = useState<'orthodox' | 'southpaw' | 'switch'>('orthodox');
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  const videoUrl = useMemo(() => (video ? URL.createObjectURL(video) : ''), [video]);
  const fighter = fighters.find(x => x.id === fighterId) ?? fighters[0];

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    if (!busy) { setProcessingStep(0); return; }
    const timer = window.setInterval(() => setProcessingStep(step => Math.min(step + 1, processingSteps.length - 1)), 4500);
    return () => window.clearInterval(timer);
  }, [busy]);

  function selectVideo(file: File | null) {
    setVideo(file); setReport(null); setError('');
  }

  async function analyze() {
    if (!video) return setError('Selecciona un video antes de analizar.');
    setBusy(true); setError(''); setReport(null);
    try {
      const body = new FormData();
      body.append('video', video); body.append('language', language); body.append('sport', sport); body.append('stance', stance);
      body.append('athlete_marker', fighter.marker);
      if (fighter.id === 'red') body.append('glove_color', 'red');
      if (fighter.id === 'blue') body.append('glove_color', 'blue');
      const response = await fetch('/api/analyze', { method: 'POST', body });
      const raw = await response.text();
      let data: Report | { error?: string } | null = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!response.ok) {
        const serverMessage = data && 'error' in data && typeof data.error === 'string' ? data.error : '';
        const upstreamHtml = (response.headers.get('content-type') || '').includes('text/html') || raw.trim().startsWith('<');
        if (serverMessage) throw new Error(serverMessage);
        if (upstreamHtml) throw new Error(`El servidor interrumpió el análisis (HTTP ${response.status}). Prueba con un clip más corto mientras Fight AI optimiza cargas largas.`);
        throw new Error(`No se pudo ejecutar el análisis (HTTP ${response.status}).`);
      }
      if (!data || !('summary' in data)) throw new Error('El servidor respondió sin un reporte válido.');
      setReport(data);
      window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); }
    finally { setBusy(false); }
  }

  function jump(time: string) {
    const node = videoRef.current; if (!node) return;
    const [m, s] = time.split(':').map(Number); node.currentTime = (m || 0) * 60 + (s || 0);
    node.play().catch(() => undefined); node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Fight AI inicio"><span className="mark">FA</span><div><b>FIGHT AI</b><small>SPARRING ANALYST</small></div></a>
        <nav className="topnav" aria-label="Navegación principal"><a href="#analyze">Analizar</a><a href="#report">Reporte</a><a href="#visual-coach">Visual Coach</a></nav>
        <div className="status"><span className="dot"/> MOTOR WEB LISTO</div>
      </header>

      <section className="hero" id="top">
        <div><span className="eyebrow">BOXING · KICKBOXING · COACHING CON EVIDENCIA</span><h1>Tu sparring,<br/><em>convertido en un plan.</em></h1><p>Selecciona el peleador, analiza patrones reales y vuelve al timestamp exacto para entender qué corregir y cómo entrenarlo.</p><div className="heroActions"><a className="cta" href="#analyze">ANALIZAR VIDEO</a><button onClick={() => { setReport(demo); setError(''); }}>VER REPORTE DEMO</button></div></div>
        <div className="heroCard"><span className="heroMetric">01</span><b>COACHING, NO ESTADÍSTICAS INVENTADAS</b><p>Observación visible → patrón → consecuencia → corrección → drill.</p><div className="miniProvider"><span>IA</span><strong>Solo acreditada si participó</strong></div></div>
      </section>

      <section className="workflowStrip" aria-label="Flujo de análisis"><span className="active">1 · Video</span><span>2 · Peleador</span><span>3 · Opciones</span><span>4 · Análisis</span><span>5 · Coaching</span></section>

      <section className="workspace" id="analyze">
        <aside className="panel uploadPanel">
          <SectionTitle n="01" title="VIDEO" subtitle="Selecciona y revisa tu sparring" />
          <input data-testid="video-input" ref={inputRef} hidden type="file" accept="video/*" onChange={e => selectVideo(e.target.files?.[0] || null)} />
          {!video ? <button className="drop" data-testid="upload-button" onClick={() => inputRef.current?.click()}><span className="uploadIcon">＋</span><strong>SUBIR SPARRING</strong><span>MP4, MOV o video compatible</span><small>Para la beta, clips cortos procesan más rápido.</small></button> : <div className="videoWrap"><video data-testid="video-preview" ref={videoRef} src={videoUrl} controls playsInline/><div className="fileRow"><div><b>{video.name}</b><span>{(video.size / 1024 / 1024).toFixed(1)} MB</span></div><button onClick={() => inputRef.current?.click()}>Cambiar</button></div></div>}

          <SectionTitle n="02" title="PELEADOR OBJETIVO" subtitle="El motor intentará mantener esta identidad" extraClass="fighterTitle" />
          <div className="fighters" role="radiogroup" aria-label="Peleador objetivo">{fighters.map(x => <button data-testid={`fighter-${x.id}`} key={x.id} role="radio" aria-checked={fighterId === x.id} className={fighterId === x.id ? 'active' : ''} onClick={() => setFighterId(x.id)}><span className="fighterVisual" style={x.color ? { '--fighter-color': x.color } as React.CSSProperties : undefined}><i/></span><span><b>{x.label}</b><small>{x.hint}</small></span><em>{fighterId === x.id ? '✓' : ''}</em></button>)}</div>

          <SectionTitle n="03" title="CONFIGURACIÓN" subtitle="Ajusta el contexto antes de analizar" extraClass="optionsTitle" />
          <div className="analysisOptions">
            <label>Disciplina<select data-testid="sport-select" value={sport} onChange={e => setSport(e.target.value as 'boxing' | 'kickboxing')}><option value="boxing">Boxeo</option><option value="kickboxing">Kickboxing</option></select></label>
            <label>Guardia<select data-testid="stance-select" value={stance} onChange={e => setStance(e.target.value as 'orthodox' | 'southpaw' | 'switch')}><option value="orthodox">Ortodoxa</option><option value="southpaw">Zurda</option><option value="switch">Switch</option></select></label>
            <label>Idioma<select value={language} onChange={e => setLanguage(e.target.value as 'es' | 'en')}><option value="es">Español</option><option value="en">English</option></select></label>
          </div>

          <button data-testid="analyze-button" className="primary" disabled={busy || !video} onClick={analyze}>{busy ? 'ANALIZANDO SPARRING…' : 'ANALIZAR SPARRING'}<span>→</span></button>
          {busy && <div className="processingCard" data-testid="processing-state"><div className="spinner"/><div><b>{processingSteps[processingStep]}</b><span>El motor revisa el video y construye el reporte. No cierres esta pestaña.</span></div><div className="processTrack">{processingSteps.map((_, i) => <i key={i} className={i <= processingStep ? 'done' : ''}/>)}</div></div>}
          {error && <div className="error" role="alert"><b>No pudimos terminar el análisis</b><span>{error}</span></div>}
        </aside>

        <section className="panel reportPanel" id="report" ref={reportRef} data-testid="report-panel">
          {!report ? <div className="empty"><span>04</span><div className="emptyRing">◎</div><h2>Tu coaching aparecerá aquí</h2><p>Después del análisis verás prioridades, fortalezas, lectura del rival, plan táctico, drills y evidencia por timestamp.</p><div className="emptyTags"><span>PRIORIDADES</span><span>RIVAL</span><span>DRILLS</span><span>TIMESTAMPS</span></div></div> : <ReportView report={report} fighter={fighter.label} jump={jump} />}
        </section>
      </section>
      <footer>Fight AI · Herramienta de apoyo técnico. La decisión final siempre pertenece al atleta y su entrenador.</footer>
    </main>
  );
}

function SectionTitle({ n, title, subtitle, extraClass = '' }: { n: string; title: string; subtitle: string; extraClass?: string }) { return <div className={`sectionTitle ${extraClass}`}><span>{n}</span><div><b>{title}</b><small>{subtitle}</small></div></div>; }

function ReportView({ report, fighter, jump }: { report: Report; fighter: string; jump: (time: string) => void }) {
  return <div data-testid="report-content">
    <div className="reportHead"><div><span className="eyebrow">REPORTE DE COACHING</span><h2>{fighter}</h2><small>{report.mode === 'demo' ? 'Vista demo · no es análisis real' : 'Análisis completado'}</small></div><div className="reportActions"><div data-testid="provider-badge" className={report.usedInReport ? 'aiBadge on' : 'aiBadge'}><span className="dot"/>{report.usedInReport ? `${report.provider} · PARTICIPÓ` : report.mode === 'demo' ? 'DEMO · IA NO USADA' : `${report.provider} · NO USADO`}</div><button data-testid="print-report" onClick={() => window.print()}>EXPORTAR / PDF</button></div></div>
    <div className="takeaway"><span>LO MÁS IMPORTANTE</span><p>{report.summary}</p></div>
    <div className="reportNav"><a href="#priorities">Prioridades</a><a href="#opponent">Rival</a><a href="#visual-coach">Visual Coach</a><a href="#evidence">Evidencia</a></div>
    <div className="grid3"><Card title="FORTALEZAS" items={report.strengths} tone="good"/><Card title="PRIORIDADES" items={report.priorities} tone="focus" id="priorities"/><Card title="LECTURA DEL RIVAL" items={report.opponent} tone="neutral" id="opponent"/></div>
    <div className="strategy"><div><h3>PLAN TÁCTICO</h3>{report.plan.length ? report.plan.map((x,i)=><p key={`${i}-${x}`}><b>0{i+1}</b><span>{x}</span></p>) : <p className="muted">Sin plan adicional reportado.</p>}</div><div><h3>DRILLS PARA LA PRÓXIMA SESIÓN</h3>{report.drills.length ? report.drills.map((x,i)=><p key={`${i}-${x}`}><b>0{i+1}</b><span>{x}</span></p>) : <p className="muted">Sin drills adicionales reportados.</p>}</div></div>
    <section className="visualCoach" id="visual-coach"><div><span className="eyebrow">VISUAL COACH</span><h3>Convierte la prioridad #1 en una imagen mental</h3><p>{report.priorities[0] || 'Mantén una base recuperable antes de atacar.'}</p></div><div className="coachDiagram" aria-label="Diagrama simplificado de entrada y salida"><span className="fighterDot">TÚ</span><i className="lineArrow">→</i><span className="targetDot">RIVAL</span><b>ENTRA CON BASE · SAL POR ÁNGULO ↗</b></div></section>
    <h3 className="evidenceTitle" id="evidence">EVIDENCIA REPRODUCIBLE <span>{report.evidence.length} momentos</span></h3>
    <div className="evidence">{report.evidence.length ? report.evidence.map((e,i) => <button data-testid="evidence-item" key={`${i}-${e.time}-${e.title}`} onClick={() => jump(e.time)}><time>{e.time}</time><div><b>{e.title}</b><span>{e.observation}</span><small><strong>CORRECCIÓN</strong>{e.correction}</small></div><em>▶</em></button>) : <div className="noEvidence">Este reporte no devolvió timestamps verificables. Fight AI no inventa evidencia.</div>}</div>
  </div>;
}

function Card({ title, items, tone, id }: { title: string; items: string[]; tone: 'good' | 'focus' | 'neutral'; id?: string }) { return <div className={`card ${tone}`} id={id}><h3>{title}</h3>{items.length ? items.map((x,i)=><p key={`${i}-${x}`}><span>{String(i+1).padStart(2,'0')}</span>{x}</p>) : <p className="muted">Sin hallazgos adicionales.</p>}</div>; }
