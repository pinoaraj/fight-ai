'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Evidence = { time: string; title: string; observation: string; correction: string };
type Report = {
  mode: 'real' | 'demo'; provider: string; usedInReport: boolean; summary: string;
  strengths: string[]; priorities: string[]; opponent: string[]; plan: string[]; drills: string[]; evidence: Evidence[];
};
type Anchor = { x: number; y: number; size: number } | null;

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
    { time: '00:34', title: 'Entrada desde distancia larga', observation: 'La cabeza y el torso cruzan la línea antes de que la base termine de cerrar distancia.', correction: 'Acorta con los pies primero; golpea cuando el pie trasero ya acompaña la entrada.' },
    { time: '00:52', title: 'Recuperación lenta después de atacar', observation: 'La combinación termina frente al rival sin un cambio inmediato de ángulo.', correction: 'Programa la salida como parte de la combinación: último golpe → pivote o paso lateral.' },
  ],
};

const processingSteps = ['Subiendo video', 'Preparando video para IA', 'Identificando al peleador', 'Leyendo patrones técnicos', 'Analizando rival y estrategia', 'Construyendo coaching'];

function seconds(time: string) {
  const parts = time.split(':').map(Number);
  return parts.length === 2 ? (parts[0] || 0) * 60 + (parts[1] || 0) : Number(time) || 0;
}

async function captureFrame(src: string, at: number) {
  return new Promise<string>((resolve) => {
    const v = document.createElement('video');
    v.src = src; v.muted = true; v.preload = 'auto'; v.playsInline = true;
    const finish = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(v.videoWidth || 960, 960);
        canvas.height = Math.round(canvas.width * ((v.videoHeight || 540) / (v.videoWidth || 960)));
        canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .78));
      } catch { resolve(''); }
      v.removeAttribute('src'); v.load();
    };
    v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(Math.max(0, at), Math.max(0, v.duration - .1)); }, { once: true });
    v.addEventListener('seeked', finish, { once: true });
    v.addEventListener('error', () => resolve(''), { once: true });
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
  const [previewTime, setPreviewTime] = useState(0);
  const [focuses, setFocuses] = useState<string[]>(['technique','weaknesses','strategy']);
  const [customFocus, setCustomFocus] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [frames, setFrames] = useState<Record<string,string>>({});
  const [replayStatus, setReplayStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  const videoUrl = useMemo(() => (video ? URL.createObjectURL(video) : ''), [video]);
  const processingStep = Math.min(processingSteps.length - 1, Math.floor(elapsed / 28));

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!report || !videoUrl || !report.evidence.length) return;
    let cancelled = false;
    (async () => {
      const next: Record<string,string> = {};
      for (const e of report.evidence.slice(0, 4)) next[e.time] = await captureFrame(videoUrl, seconds(e.time));
      if (!cancelled) setFrames(next);
    })();
    return () => { cancelled = true; };
  }, [report, videoUrl]);

  function selectVideo(file: File | null) {
    setVideo(file); setReport(null); setFrames({}); setAnchor(null); setMarking(false); setPreviewReady(false); setPreviewTime(0); setError(''); setReplayStatus('');
  }
  function toggleFocus(id: string) { setFocuses(x => x.includes(id) ? x.filter(v => v !== id) : [...x, id]); }
  function primePreview(node: HTMLVideoElement) {
    node.pause();
    const duration = Number.isFinite(node.duration) ? node.duration : 0;
    const target = duration > 0 ? Math.min(Math.max(duration * 0.035, 0.8), Math.min(4, Math.max(0, duration - .15))) : .8;
    const done = () => { setPreviewReady(true); setPreviewTime(node.currentTime || target); };
    node.addEventListener('seeked', done, { once: true });
    try { node.currentTime = target; } catch { setPreviewReady(node.readyState >= 2); }
  }
  function toggleMarking() {
    const node = videoRef.current;
    if (node) {
      node.pause();
      if (!previewReady || node.currentTime < .05) primePreview(node);
      else setPreviewTime(node.currentTime);
    }
    setMarking(x => !x);
  }
  function setAnchorFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ x: ((e.clientX-r.left)/r.width)*100, y: ((e.clientY-r.top)/r.height)*100, size: anchor?.size || 24 });
    setMarking(false);
    setPreviewTime(videoRef.current?.currentTime || previewTime);
  }

  async function analyze() {
    if (!video) return setError('Selecciona un video antes de analizar.');
    if (!anchor && !gloveColor && !topColor && !fighterNotes.trim()) return setError('Marca al peleador o agrega características para poder seguirlo durante el video.');
    setBusy(true); setError(''); setReport(null); setFrames({});
    try {
      const body = new FormData();
      body.append('video', video); body.append('language', language); body.append('sport', sport); body.append('stance', stance);
      body.append('athlete_marker', anchor ? 'visual_anchor' : 'visual_reid');
      body.append('glove_color', gloveColor); body.append('top_color', topColor); body.append('relative_height', relativeHeight);
      body.append('build', build); body.append('fighter_notes', fighterNotes); body.append('analysis_focus', focuses.join(',')); body.append('custom_focus', customFocus);
      if (anchor) { body.append('anchor_x', anchor.x.toFixed(2)); body.append('anchor_y', anchor.y.toFixed(2)); body.append('anchor_size', anchor.size.toFixed(2)); body.append('anchor_time', previewTime.toFixed(2)); }
      const response = await fetch('/api/analyze', { method: 'POST', body });
      const raw = await response.text(); let data: Report | { error?: string } | null = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
      if (!response.ok) {
        const serverMessage = data && 'error' in data && typeof data.error === 'string' ? data.error : '';
        if (serverMessage) throw new Error(serverMessage);
        throw new Error(`El análisis terminó con HTTP ${response.status}.`);
      }
      if (!data || !('summary' in data)) throw new Error('El servidor respondió sin un reporte válido.');
      setReport(data); window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado.'); }
    finally { setBusy(false); }
  }

  function jump(time: string) {
    const node = videoRef.current; if (!node) return;
    const target = seconds(time); setReplayStatus(`Preparando evidencia ${time}…`);
    const seek = () => {
      node.pause(); node.currentTime = Math.min(target, Math.max(0, node.duration || target));
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const done = () => { setReplayStatus(`Reproduciendo evidencia desde ${time}`); node.play().catch(() => undefined); };
      node.addEventListener('seeked', done, { once: true });
    };
    if (node.readyState < 1) node.addEventListener('loadedmetadata', seek, { once: true }); else seek();
  }

  return <main>
    <header className="topbar"><a className="brand" href="#top"><span className="mark">FA</span><div><b>FIGHT AI</b><small>SPARRING ANALYST</small></div></a><nav className="topnav"><a href="#analyze">Analizar</a><a href="#report">Reporte</a><a href="#visual-coach">Visual Coach</a></nav><div className="status"><span className="dot"/> MOTOR WEB</div></header>
    <section className="hero" id="top"><div><span className="eyebrow">BOXING · KICKBOXING · COACHING CON EVIDENCIA</span><h1>Tu sparring,<br/><em>convertido en un plan.</em></h1><p>Marca al peleador, describe quién es y dile al coach virtual qué quieres mejorar. El reporte debe explicar patrones, causas, consecuencias y correcciones con evidencia.</p><div className="heroActions"><a className="cta" href="#analyze">ANALIZAR VIDEO</a><button onClick={() => setReport(demo)}>VER REPORTE DEMO</button></div></div><div className="heroCard"><span className="heroMetric">01</span><b>OJO CLÍNICO, NO CONSEJOS GENÉRICOS</b><p>Patrón visible → causa → consecuencia táctica → corrección → drill → evidencia.</p></div></section>
    <section className="workflowStrip"><span className="active">1 · Video</span><span>2 · Marcar peleador</span><span>3 · Características</span><span>4 · Foco del coach</span><span>5 · Reporte</span></section>

    <section className="workspace" id="analyze"><aside className="panel uploadPanel">
      <SectionTitle n="01" title="VIDEO" subtitle="Selecciona y revisa tu sparring" />
      <input data-testid="video-input" ref={inputRef} hidden type="file" accept="video/*" onChange={e => selectVideo(e.target.files?.[0] || null)} />
      {!video ? <button className="drop" data-testid="upload-button" onClick={() => inputRef.current?.click()}><span className="uploadIcon">＋</span><strong>SUBIR SPARRING</strong><span>MP4, MOV o compatible</span></button> : <div className="videoWrap"><div className={`videoStage ${marking?'isMarking':''}`}><video data-testid="video-preview" ref={videoRef} src={videoUrl} controls={!marking} playsInline preload="auto" onLoadedMetadata={e=>primePreview(e.currentTarget)} onSeeked={e=>{if(!marking)setPreviewTime(e.currentTarget.currentTime)}}/>{anchor && <div className="fighterCircle" style={{left:`${anchor.x}%`,top:`${anchor.y}%`,width:`${anchor.size}%`,aspectRatio:'1'}}/>}{marking && <div className="markerOverlay" data-testid="marker-overlay" onClick={setAnchorFromEvent}><span>Haz clic sobre el centro del peleador</span></div>}</div><div className="previewHint" data-testid="preview-status"><b>{previewReady?'FRAME VISIBLE LISTO':'CARGANDO FRAME…'}</b><span>{previewReady?'Mueve la barra del video al momento donde mejor se vea el peleador y luego presiona “Marcar peleador”.':'Fight AI está buscando automáticamente un frame visible para que no marques sobre una pantalla negra.'}</span></div><div className="fileRow"><div><b>{video.name}</b><span>{(video.size/1024/1024).toFixed(1)} MB</span></div><button onClick={() => inputRef.current?.click()}>Cambiar</button></div>{replayStatus && <div className="replayStatus">▶ {replayStatus}</div>}</div>}

      <SectionTitle n="02" title="SELECCIONA AL PELEADOR" subtitle="Pausa en un frame claro y circula al peleador como en Android" extraClass="fighterTitle" />
      <div className="anchorControls"><button data-testid="mark-fighter" className={marking?'active':''} disabled={!video||!previewReady} onClick={toggleMarking}>{anchor?'AJUSTAR CÍRCULO':'MARCAR PELEADOR'}</button>{anchor && <button onClick={()=>setAnchor(null)}>Limpiar</button>}</div>
      {anchor && <><div className="anchorConfirmed">✓ Peleador marcado en {Math.floor(previewTime/60)}:{String(Math.floor(previewTime%60)).padStart(2,'0')}</div><label className="rangeLabel">Tamaño del círculo<input type="range" min="12" max="48" value={anchor.size} onChange={e=>setAnchor({...anchor,size:Number(e.target.value)})}/></label></>}

      <SectionTitle n="03" title="CARACTERÍSTICAS" subtitle="Ayuda al motor a mantener la identidad" extraClass="optionsTitle" />
      <div className="identityGrid"><label>Color de guantes<input data-testid="glove-color" value={gloveColor} onChange={e=>setGloveColor(e.target.value)} placeholder="Ej. rojos"/></label><label>Ropa / polera<input value={topColor} onChange={e=>setTopColor(e.target.value)} placeholder="Ej. polera negra"/></label><label>Altura relativa<select value={relativeHeight} onChange={e=>setRelativeHeight(e.target.value)}><option value="">No sé</option><option value="shorter">Más bajo</option><option value="similar">Similar</option><option value="taller">Más alto</option></select></label><label>Contextura<select value={build} onChange={e=>setBuild(e.target.value)}><option value="">No sé</option><option value="slim">Delgada</option><option value="medium">Media / atlética</option><option value="stocky">Robusta</option></select></label><label className="wide">Otras características<textarea data-testid="fighter-notes" value={fighterNotes} onChange={e=>setFighterNotes(e.target.value)} placeholder="Ej. más bajo, pelo corto, shorts negros, protector rojo…"/></label></div>

      <SectionTitle n="04" title="FOCO DEL COACH" subtitle="Dile qué quieres que priorice" extraClass="optionsTitle" />
      <div className="focusGrid">{focusOptions.map(([id,label])=><button data-testid={`focus-${id}`} key={id} className={focuses.includes(id)?'active':''} onClick={()=>toggleFocus(id)}>{focuses.includes(id)?'✓ ':''}{label}</button>)}</div>
      <label className="customFocus">Objetivo personalizado<textarea value={customFocus} onChange={e=>setCustomFocus(e.target.value)} placeholder="Ej. quiero saber por qué me conectan al entrar, cómo cerrar mejor la distancia y qué estrategia usar contra este rival."/></label>

      <SectionTitle n="05" title="CONFIGURACIÓN" subtitle="Contexto del análisis" extraClass="optionsTitle" />
      <div className="analysisOptions"><label>Disciplina<select data-testid="sport-select" value={sport} onChange={e=>setSport(e.target.value as 'boxing'|'kickboxing')}><option value="boxing">Boxeo</option><option value="kickboxing">Kickboxing</option></select></label><label>Guardia<select data-testid="stance-select" value={stance} onChange={e=>setStance(e.target.value as 'orthodox'|'southpaw'|'switch')}><option value="orthodox">Ortodoxa</option><option value="southpaw">Zurda</option><option value="switch">Switch</option></select></label><label>Idioma<select value={language} onChange={e=>setLanguage(e.target.value as 'es'|'en')}><option value="es">Español</option><option value="en">English</option></select></label></div>

      <button data-testid="analyze-button" className="primary" disabled={busy||!video} onClick={analyze}>{busy?'ANALIZANDO SPARRING…':'ANALIZAR SPARRING'}<span>→</span></button>
      {busy && <div className="processingCard" data-testid="processing-state"><div className="spinner"/><div><b>{processingSteps[processingStep]}</b><span>{elapsed<60?`${elapsed}s transcurridos`:`${Math.floor(elapsed/60)}m ${elapsed%60}s transcurridos`} · videos grandes pueden tardar varios minutos.</span></div><div className="processTrack">{processingSteps.map((_,i)=><i key={i} className={i<=processingStep?'done':''}/>)}</div></div>}
      {error && <div className="error" role="alert"><b>No pudimos terminar el análisis</b><span>{error}</span></div>}
    </aside>

    <section className="panel reportPanel" id="report" ref={reportRef} data-testid="report-panel">{!report?<div className="empty"><span>06</span><div className="emptyRing">◎</div><h2>Tu coaching aparecerá aquí</h2><p>El reporte mostrará si Gemini participó, prioridades, rival, estrategia, drills, videos de corrección y evidencia reproducible.</p></div>:<ReportView report={report} jump={jump} frames={frames}/>}</section></section>
    <footer>Fight AI · Herramienta de apoyo técnico. La decisión final pertenece al atleta y su entrenador.</footer>
  </main>;
}

function SectionTitle({n,title,subtitle,extraClass=''}:{n:string;title:string;subtitle:string;extraClass?:string}) { return <div className={`sectionTitle ${extraClass}`}><span>{n}</span><div><b>{title}</b><small>{subtitle}</small></div></div>; }

function ReportView({report,jump,frames}:{report:Report;jump:(time:string)=>void;frames:Record<string,string>}) {
  const footworkIssue = report.priorities.some(x=>/foot|pie|pies|base|piv|ángulo|distancia|entrada|salida/i.test(x));
  return <div data-testid="report-content">
    <div className="reportHead"><div><span className="eyebrow">REPORTE DE COACHING</span><h2>Análisis técnico</h2><small>{report.mode==='demo'?'Vista demo · no es análisis real':'Análisis completado'}</small></div><div className="reportActions"><div data-testid="provider-badge" className={report.usedInReport?'aiBadge on':'aiBadge'}><span className="dot"/>{report.usedInReport?`${report.provider.toUpperCase()} · SÍ PARTICIPÓ EN ESTE REPORTE`:`${report.provider.toUpperCase()} · NO PARTICIPÓ`}</div><button data-testid="print-report" onClick={()=>window.print()}>EXPORTAR REPORTE A PDF + IMÁGENES</button></div></div>
    <div className="takeaway"><span>DIAGNÓSTICO PRINCIPAL</span><p>{report.summary}</p></div>
    <div className="reportNav"><a href="#priorities">Prioridades</a><a href="#opponent">Rival</a><a href="#visual-coach">Visual Coach</a><a href="#evidence">Evidencia</a></div>
    <div className="grid3"><Card title="FORTALEZAS QUE DEBES CONSERVAR" items={report.strengths} tone="good"/><Card title="PRIORIDADES CLÍNICAS" items={report.priorities} tone="focus" id="priorities"/><Card title="LECTURA DEL RIVAL" items={report.opponent} tone="neutral" id="opponent"/></div>
    <div className="strategy"><div><h3>PLAN TÁCTICO</h3>{report.plan.map((x,i)=><p key={x+i}><b>0{i+1}</b><span>{x}</span></p>)}</div><div><h3>DRILLS PRESCRITOS</h3>{report.drills.map((x,i)=><p key={x+i}><b>0{i+1}</b><span>{x}</span></p>)}</div></div>
    <section className="visualCoach" id="visual-coach"><div><span className="eyebrow">VISUAL COACH</span><h3>Corrección ligada al problema detectado</h3><p>{report.priorities[0]||'Mantén una base recuperable antes de atacar.'}</p></div><div className="coachDiagram"><span className="fighterDot">TÚ</span><i className="lineArrow">→</i><span className="targetDot">RIVAL</span><b>ENTRA CON BASE · TERMINA EQUILIBRADO · SAL POR ÁNGULO ↗</b></div></section>
    <section className="lessonSection"><div className="lessonHead"><span className="eyebrow">VIDEOS DE CORRECCIÓN</span><h3>{footworkIssue?'Footwork, pivote y salidas':'Fundamentos aplicables a tu prioridad principal'}</h3></div><div className="lessonGrid"><article><iframe src="https://www.youtube.com/embed/-OK0kpv58Rk" title="Cómo mejorar footwork de boxeo" allowFullScreen/><b>Footwork: cómo corregirlo</b><span>Tony Jeffries · usa este video para comparar base, desplazamiento y pies demasiado abiertos.</span></article><article><iframe src="https://www.youtube.com/embed/hNclexRmDsY" title="Cómo pivotar en boxeo" allowFullScreen/><b>Pivote y salida por ángulo</b><span>Tony Jeffries · referencia visual para no quedar frente al rival después de atacar.</span></article></div></section>
    <h3 className="evidenceTitle" id="evidence">EVIDENCIA REPRODUCIBLE <span>{report.evidence.length} momentos</span></h3>
    <div className="evidence">{report.evidence.length?report.evidence.map((e,i)=><button data-testid="evidence-item" key={`${i}-${e.time}`} onClick={()=>jump(e.time)}>{frames[e.time]?<img src={frames[e.time]} alt={`Captura del sparring en ${e.time}`}/>:<div className="framePlaceholder">CAPTURA<br/>CARGANDO</div>}<time>{e.time}</time><div><b>{e.title}</b><span>{e.observation}</span><small><strong>CORRECCIÓN</strong>{e.correction}</small></div><em>▶</em></button>):<div className="noEvidence">Este reporte no devolvió timestamps verificables. Fight AI no inventa evidencia.</div>}</div>
  </div>;
}

function Card({title,items,tone,id}:{title:string;items:string[];tone:'good'|'focus'|'neutral';id?:string}) { return <div className={`card ${tone}`} id={id}><h3>{title}</h3>{items.length?items.map((x,i)=><p key={`${i}-${x}`}><span>{String(i+1).padStart(2,'0')}</span>{x}</p>):<p className="muted">Sin hallazgos adicionales.</p>}</div>; }