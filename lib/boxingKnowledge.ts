export type BoxingKnowledgeRegion = 'UNIVERSAL' | 'USA' | 'UK' | 'RESEARCH';
export type BoxingKnowledgeDomain =
  | 'STANCE' | 'GUARD' | 'FOOTWORK' | 'DISTANCE' | 'OFFENSE' | 'DEFENSE'
  | 'COUNTERING' | 'ENTRY' | 'EXIT' | 'FEINTS' | 'BALANCE' | 'TACTICS' | 'BODY_ATTACK'
  | 'SCORING' | 'RINGCRAFT' | 'FATIGUE';

export type BoxingKnowledgeSource = {
  authority: string;
  url: string;
  kind: 'official_coaching' | 'official_rules' | 'peer_reviewed';
  evidence: 'coaching_standard' | 'competition_rules' | 'systematic_review' | 'elite_biomechanics' | 'biomechanics' | 'physiology' | 'fatigue_biomechanics';
  note: string;
};

export type BoxingKnowledgeEntry = {
  id: string;
  title: string;
  domains: BoxingKnowledgeDomain[];
  regions: BoxingKnowledgeRegion[];
  observableCues: string[];
  consequence: string;
  correction: string;
  drill: string;
  sourceIds: (keyof typeof BOXING_KNOWLEDGE_SOURCES)[];
};

export const BOXING_KNOWLEDGE_VERSION = '2026.09.04-v3';

// Hybrid provenance policy:
// - Official boxing bodies define coachable technical/tactical fundamentals and competition criteria.
// - Peer-reviewed university / institute research supports biomechanical and physiological claims.
// - Research never creates a diagnosis by itself; the video must show the cue.
// - National labels are not used as technique stereotypes.
// - Fight AI does not infer scores, fatigue or punch metrics unless the video provides enough visible evidence.
export const BOXING_KNOWLEDGE_SOURCES = {
  IBA_COACH_MANUAL: {
    authority: 'International Boxing Association (IBA) Coaches Manual',
    url: 'https://www.iba.sport/documents/iba-coach-manual/',
    kind: 'official_coaching',
    evidence: 'coaching_standard',
    note: 'Standardized coach reference covering boxing technique, tactics, physical preparation and teaching progression.',
  },
  ENGLAND_BOXING_L1: {
    authority: 'England Boxing — Level 1 Coaching Handbook',
    url: 'https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf',
    kind: 'official_coaching',
    evidence: 'coaching_standard',
    note: 'National governing-body handbook for basic boxing skills, movement, offence, defence and coaching progression.',
  },
  USA_BOXING_EDUCATION: {
    authority: 'USA Boxing Coaching Education',
    url: 'https://www.usaboxing.org/usa-boxing-launches-team-usa-mobile-coach-app',
    kind: 'official_coaching',
    evidence: 'coaching_standard',
    note: 'USA Boxing describes trusted education resources for boxing fundamentals, advanced strategy, match review and high-performance preparation.',
  },
  WORLD_BOXING_RULES: {
    authority: 'World Boxing Competition Rules — Judging a Bout',
    url: 'https://worldboxing.org/wp-content/uploads/2024/11/World-Boxing-Competition-Rules-Nov-2024-Approved.pdf',
    kind: 'official_rules',
    evidence: 'competition_rules',
    note: 'Defines scoring priority around scoring blows, technical/tactical superiority and competitiveness; forward movement alone is not automatically effective aggression.',
  },
  INSEP_LJMU_ELITE_PUNCHING: {
    authority: 'INSEP + Liverpool John Moores University — Dinu & Louis (2020)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33345181/',
    kind: 'peer_reviewed',
    evidence: 'elite_biomechanics',
    note: 'IMU study comparing elite/potential Olympic medalist and junior boxers; supports whole-body segment synchronization, force, velocity and stability reasoning.',
  },
  LEAD_STRAIGHT_BIOMECHANICS: {
    authority: 'Peer-reviewed lead straight punch biomechanics study (2022)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36589432/',
    kind: 'peer_reviewed',
    evidence: 'biomechanics',
    note: '3D motion capture and force-platform study linking lower-extremity force development with lead-straight punching performance.',
  },
  PUNCH_FORCE_SYSTEMATIC_REVIEW: {
    authority: 'Systematic review/meta-analysis of upper-limb strike force and velocity (2020)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32677587/',
    kind: 'peer_reviewed',
    evidence: 'systematic_review',
    note: 'Cross-study synthesis of upper-limb strike mechanics; used only for general biomechanical context, never to fabricate Fight AI punch metrics.',
  },
  BOXING_ACUTE_RESPONSES_REVIEW: {
    authority: 'Edge Hill University — acute responses to amateur boxing systematic review/meta-analysis (2022/2023)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35380916/',
    kind: 'peer_reviewed',
    evidence: 'physiology',
    note: 'Systematic review of 25 studies showing substantial physiological demands while cautioning that task-specific performance does not necessarily deteriorate after boxing activity.',
  },
  LOWER_BODY_FATIGUE_PUNCHING: {
    authority: 'Highly-trained boxer lower-body fatigue and punch-force study (2021)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33858296/',
    kind: 'peer_reviewed',
    evidence: 'fatigue_biomechanics',
    note: 'Reports lower punch force and rate-of-force-development after fatiguing exercise, supporting lower-body/trunk contribution while not justifying visual fatigue diagnosis by clock time alone.',
  },
  LOWER_LIMB_KINETICS_FATIGUE_2025: {
    authority: 'Ningbo University + University of the West of Scotland + Hong Kong Baptist University — lower-limb kinetics and fatigue in boxing (2025)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41463652/',
    kind: 'peer_reviewed',
    evidence: 'fatigue_biomechanics',
    note: 'Force-platform study reporting fatigue-related punch-force reductions and individual variability across punch types; used to support cautious kinetic-chain hypotheses.',
  },
  PLANTAR_PRESSURE_BOXING_2026: {
    authority: 'Wearable Sensor-Based Analysis of Punch Acceleration and Plantar Pressure Distribution in Boxing (2026)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/42122430/',
    kind: 'peer_reviewed',
    evidence: 'biomechanics',
    note: 'Collegiate boxer study reporting associations between forefoot loading and punch acceleration; supports lower-body kinetic-chain hypotheses.',
  },
} as const satisfies Record<string, BoxingKnowledgeSource>;

export const BOXING_KNOWLEDGE: BoxingKnowledgeEntry[] = [
  {
    id: 'guard-recovery-after-offense',
    title: 'Recuperación de guardia después de atacar',
    domains: ['GUARD','DEFENSE','EXIT'],
    regions: ['UNIVERSAL','USA','UK'],
    observableCues: ['mano tarda en volver', 'mano queda abajo después del golpe', 'queda abierto después de combinar', 'salida sin guardia'],
    consequence: 'El final de la ofensiva abre una ventana de contraataque y retrasa la siguiente defensa.',
    correction: 'Recuperar las manos a una posición defensiva útil durante el final de la combinación y enlazar la recuperación con salida, bloqueo o evasión.',
    drill: '2–3 golpes → manos a casa → defensa o salida 45°; 3×2 min con compañero devolviendo un contraataque técnico.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_L1','USA_BOXING_EDUCATION'],
  },
  {
    id: 'kinetic-chain-before-arm-only-power',
    title: 'Coordinar base, tronco y brazo para golpear',
    domains: ['STANCE','BALANCE','OFFENSE'],
    regions: ['UNIVERSAL','RESEARCH'],
    observableCues: ['golpea solo con el brazo', 'hombro inicia todo el golpe', 'torso llega antes que pies', 'pierde balance al impactar'],
    consequence: 'Una secuencia corporal pobre reduce control y puede obligar al brazo/hombro a compensar el golpe.',
    correction: 'Generar el golpe desde una base recuperable y coordinar la contribución de piernas, tronco y brazo sin sacrificar postura.',
    drill: 'Straight punches con pausa de balance: base → rotación → brazo → recuperación; 3×90 s, primero técnico y luego progresivo.',
    sourceIds: ['IBA_COACH_MANUAL','INSEP_LJMU_ELITE_PUNCHING','LEAD_STRAIGHT_BIOMECHANICS','PLANTAR_PRESSURE_BOXING_2026'],
  },
  {
    id: 'base-before-reaching',
    title: 'Cerrar distancia con la base antes de alcanzar',
    domains: ['STANCE','BALANCE','DISTANCE','ENTRY'],
    regions: ['UNIVERSAL','UK','RESEARCH'],
    observableCues: ['sobreextensión', 'se inclina para alcanzar', 'cabeza se proyecta muy delante de la base', 'pies quedan atrás al entrar'],
    consequence: 'El atleta pierde capacidad de frenar, defender y salir con rapidez después del golpe.',
    correction: 'Acortar la distancia primero con los pies y mantener una postura que permita golpear y recuperar sin tener que “caer” hacia el rival.',
    drill: 'Step-jab y 1–2 con pausa final: si no puede congelarse equilibrado tras el golpe, acortar el paso/alcance.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_L1','LEAD_STRAIGHT_BIOMECHANICS'],
  },
  {
    id: 'movement-is-defense-and-offense',
    title: 'Integrar desplazamiento con ataque y defensa',
    domains: ['FOOTWORK','DEFENSE','OFFENSE','EXIT'],
    regions: ['UNIVERSAL','UK'],
    observableCues: ['ataca estático', 'defiende sin reposicionarse', 'permanece en línea después de golpear', 'rival lo encuentra en el mismo sitio'],
    consequence: 'El rival puede prever la posición final y encadenar una segunda acción con menos reajuste.',
    correction: 'Conectar la técnica de manos con ajustes de distancia y posición: entrar, golpear, defender y terminar en un lugar útil.',
    drill: 'Jab → paso lateral; 1–2 → pivote; defensa → contra → salida; 3×2 min.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_L1','USA_BOXING_EDUCATION'],
  },
  {
    id: 'defense-creates-counter',
    title: 'Convertir una defensa exitosa en iniciativa',
    domains: ['DEFENSE','COUNTERING','TACTICS'],
    regions: ['UNIVERSAL','USA','UK'],
    observableCues: ['bloquea y no responde', 'slip sin contra', 'cede iniciativa después de defender', 'rival reinicia gratis'],
    consequence: 'El atleta sobrevive al primer ataque pero no castiga ni interrumpe el patrón ofensivo del rival.',
    correction: 'Vincular las defensas más frecuentes a una respuesta simple y segura, manteniendo la prioridad en salir protegido.',
    drill: 'Parry → jab; slip → cross; block → hook y salida. Rondas condicionadas a una sola defensa/respuesta.',
    sourceIds: ['ENGLAND_BOXING_L1','USA_BOXING_EDUCATION','IBA_COACH_MANUAL'],
  },
  {
    id: 'range-before-combination',
    title: 'Establecer distancia antes de combinar',
    domains: ['DISTANCE','ENTRY','OFFENSE'],
    regions: ['UNIVERSAL','USA','UK'],
    observableCues: ['golpea desde demasiado lejos', 'se inclina para alcanzar', 'primer golpe no llega', 'entra sin ocupar espacio previamente'],
    consequence: 'La combinación comienza fuera de rango y obliga a compensar con inclinación, pasos tardíos o golpes sin recorrido.',
    correction: 'Usar jab, finta o paso corto para confirmar/ganar distancia antes de comprometer golpes posteriores.',
    drill: 'Finta → paso corto → jab al pecho/cabeza → 2; reset completo si el primer golpe queda corto.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_L1','USA_BOXING_EDUCATION'],
  },
  {
    id: 'exit-off-centerline',
    title: 'No terminar siempre en la línea central',
    domains: ['EXIT','FOOTWORK','DEFENSE'],
    regions: ['UNIVERSAL','USA','UK'],
    observableCues: ['retrocede recto después de combinar', 'queda frente al rival', 'misma línea de entrada y salida', 'se queda inmóvil tras conectar'],
    consequence: 'El rival puede responder directamente o cerrar distancia sin tener que cambiar demasiado su orientación.',
    correction: 'Cuando el contexto lo permita, terminar con un pequeño cambio de ángulo o distancia sin cruzar los pies ni perder guardia.',
    drill: '1–2 → paso diagonal; 1–2–3 → pivote; marcar dos salidas en el piso y alternarlas.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_L1'],
  },
  {
    id: 'feint-to-read',
    title: 'Usar fintas para obtener información',
    domains: ['FEINTS','ENTRY','TACTICS'],
    regions: ['UNIVERSAL','USA'],
    observableCues: ['entra siempre con la misma acción', 'rival anticipa el jab', 'ataques predecibles', 'no provoca reacción antes de entrar'],
    consequence: 'El rival puede preparar su defensa o contraataque sin tener que revelar primero su intención.',
    correction: 'Usar una finta pequeña para provocar una respuesta y elegir el ataque según la reacción realmente observada.',
    drill: 'Finta de jab → leer guardia/paso → atacar una de dos respuestas previamente definidas.',
    sourceIds: ['IBA_COACH_MANUAL','USA_BOXING_EDUCATION'],
  },
  {
    id: 'short-range-create-space',
    title: 'Crear espacio útil en corta distancia',
    domains: ['DISTANCE','BODY_ATTACK','OFFENSE','TACTICS'],
    regions: ['UNIVERSAL','UK'],
    observableCues: ['pecho pegado al rival', 'golpes cortos sin recorrido', 'cabeza apoyada y brazos atrapados', 'no puede rotar gancho o uppercut'],
    consequence: 'La hipercercanía puede anular el recorrido de los golpes y facilitar amarres o control físico del rival.',
    correction: 'Antes de golpear, recuperar centímetros de espacio con postura, marco legal o pequeño reajuste de pies sin empujar de forma antirreglamentaria.',
    drill: 'Trabajo de corta distancia condicionado: crear espacio → 2 golpes compactos → salida; intensidad técnica.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_L1'],
  },
  {
    id: 'effective-pressure-not-forward-only',
    title: 'Presionar con efecto, no solo avanzar',
    domains: ['TACTICS','RINGCRAFT','SCORING','DEFENSE','OFFENSE'],
    regions: ['UNIVERSAL'],
    observableCues: ['avanza pero no conecta limpio', 'persigue en línea recta', 'presiona recibiendo los golpes más claros', 'rival dicta las salidas'],
    consequence: 'Ocupar terreno sin convertirlo en golpes claros, control técnico o ventaja posicional puede parecer iniciativa sin producir superioridad efectiva.',
    correction: 'Hacer que la presión produzca una consecuencia visible: cerrar una salida, forzar reacción, conectar limpio o defender y responder antes de volver a avanzar.',
    drill: 'Ring-cutting condicionado: puntúa solo cuando la presión termina en golpe limpio, defensa-contra o cierre de salida; 3×2 min.',
    sourceIds: ['WORLD_BOXING_RULES','IBA_COACH_MANUAL'],
  },
  {
    id: 'ring-control-through-position-and-rhythm',
    title: 'Controlar posición, ritmo y reacciones del rival',
    domains: ['TACTICS','RINGCRAFT','SCORING','FOOTWORK'],
    regions: ['UNIVERSAL'],
    observableCues: ['rival decide siempre dónde intercambiar', 'sigue al rival sin cortar ángulo', 'acepta el ritmo del rival', 'pierde centro o salida sin respuesta'],
    consequence: 'El atleta puede trabajar mucho sin imponer dónde, cuándo y en qué condiciones ocurren los intercambios.',
    correction: 'Usar desplazamiento, jab, fintas y cambios de ritmo para obligar al rival a reaccionar y orientar el intercambio hacia posiciones favorables.',
    drill: 'Ronda de control: ganar centro → provocar salida → cortar ángulo → acción corta → reset; el compañero cambia dirección libremente.',
    sourceIds: ['WORLD_BOXING_RULES','IBA_COACH_MANUAL','USA_BOXING_EDUCATION'],
  },
  {
    id: 'scoring-quality-before-volume-assumption',
    title: 'No confundir volumen con golpes puntuables',
    domains: ['SCORING','OFFENSE','TACTICS'],
    regions: ['UNIVERSAL'],
    observableCues: ['muchos golpes tocan guantes', 'ráfaga sin conexión limpia', 'golpes desde mala base', 'volumen sin blanco claro'],
    consequence: 'Una secuencia de alto volumen no implica automáticamente ventaja si los golpes no llegan limpios al área válida o carecen de control técnico.',
    correction: 'Priorizar golpes claros y técnicamente sostenibles; usar el volumen para crear aperturas, no como sustituto de precisión y control.',
    drill: 'Sparring técnico de calidad: máximo 3 golpes por entrada y solo cuenta la acción si al menos uno llega limpio sin perder postura.',
    sourceIds: ['WORLD_BOXING_RULES','IBA_COACH_MANUAL'],
  },
  {
    id: 'fatigue-must-be-visible-not-assumed',
    title: 'Diagnosticar deterioro por fatiga solo cuando sea visible',
    domains: ['FATIGUE','BALANCE','GUARD','TACTICS'],
    regions: ['UNIVERSAL','RESEARCH'],
    observableCues: ['guardia empeora progresivamente', 'base se estrecha o cruza más tarde', 'recuperación entre golpes se hace más lenta', 'patrón técnico empeora al avanzar el round'],
    consequence: 'Atribuir un error a fatiga solo porque ocurre tarde en el round puede confundir un patrón técnico estable con un problema de acondicionamiento.',
    correction: 'Comparar el mismo patrón temprano y tarde. Solo hablar de posible fatiga cuando haya deterioro repetido y temporalmente progresivo en postura, recuperación o ejecución.',
    drill: 'Repetir la misma combinación al inicio y final de una ronda controlada; el coach evalúa postura, guardia y salida, no potencia estimada.',
    sourceIds: ['BOXING_ACUTE_RESPONSES_REVIEW','LOWER_BODY_FATIGUE_PUNCHING','LOWER_LIMB_KINETICS_FATIGUE_2025'],
  },
  {
    id: 'late-round-kinetic-chain-preservation',
    title: 'Conservar base y cadena cinética bajo cansancio',
    domains: ['FATIGUE','BALANCE','OFFENSE','STANCE'],
    regions: ['UNIVERSAL','RESEARCH'],
    observableCues: ['golpea más con brazos al final', 'piernas dejan de acompañar el cross o gancho', 'pierde postura después de golpes fuertes', 'rotación disminuye y empuja el golpe'],
    consequence: 'Cuando la contribución de piernas y tronco cae, el atleta puede compensar con el tren superior y perder control, continuidad o eficiencia.',
    correction: 'Reducir complejidad y potencia si la base deja de sostener la técnica; privilegiar golpes simples, recuperación rápida y colocación antes de volver a cargar.',
    drill: 'Final de ronda: 20 s de desplazamiento activo → 20 s jab-cross técnico → 20 s salida/guardia; repetir sin perseguir potencia máxima.',
    sourceIds: ['LOWER_BODY_FATIGUE_PUNCHING','LOWER_LIMB_KINETICS_FATIGUE_2025','INSEP_LJMU_ELITE_PUNCHING'],
  },
  {
    id: 'individualize-style',
    title: 'Individualizar el fundamento al atleta y al rival',
    domains: ['TACTICS','STANCE','FOOTWORK'],
    regions: ['UNIVERSAL','RESEARCH'],
    observableCues: ['técnica funciona solo en ciertos contextos', 'atributos físicos cambian la solución', 'rival obliga adaptación', 'dos soluciones técnicas son plausibles'],
    consequence: 'Aplicar una plantilla rígida puede reemplazar una solución funcional por una corrección genérica.',
    correction: 'Tratar cada fundamento como una hipótesis y conservar solo la corrección que el video y el contexto apoyan para ese atleta.',
    drill: 'Recrear la misma situación con dos soluciones y comparar cuál mantiene mejor balance, defensa, distancia y capacidad de continuar.',
    sourceIds: ['IBA_COACH_MANUAL','USA_BOXING_EDUCATION','INSEP_LJMU_ELITE_PUNCHING','PUNCH_FORCE_SYSTEMATIC_REVIEW'],
  },
];

const DOMAIN_KEYWORDS: Record<BoxingKnowledgeDomain, string[]> = {
  STANCE: ['stance','guardia','postura'],
  GUARD: ['guard','guardia','hands','manos'],
  FOOTWORK: ['footwork','pies','movimiento','pivot','pivote'],
  DISTANCE: ['distance','distancia','range','timing','espacio'],
  OFFENSE: ['offense','ofensiva','ataque','golpe'],
  DEFENSE: ['defense','defensa','slip','bloque','parry'],
  COUNTERING: ['counter','contra','respuesta'],
  ENTRY: ['entry','entrada','entrar','cerrar distancia'],
  EXIT: ['exit','salida','salir','ángulo','angle'],
  FEINTS: ['feint','finta'],
  BALANCE: ['balance','equilibrio','base'],
  TACTICS: ['strategy','estrategia','táctica','rival','ritmo','presión'],
  BODY_ATTACK: ['body','cuerpo','hígado','corta distancia'],
  SCORING: ['score','scoring','puntuar','puntuación','golpe limpio','golpes claros'],
  RINGCRAFT: ['ringcraft','ring control','control del ring','centro','cortar ring','cortar salida'],
  FATIGUE: ['fatigue','fatiga','cansancio','cansado','late round','final del round'],
};

export function retrieveBoxingKnowledge(input: string, limit = 8) {
  const normalized = input.toLowerCase();
  const scored = BOXING_KNOWLEDGE.map((entry) => {
    let score = 0;
    for (const domain of entry.domains) {
      for (const keyword of DOMAIN_KEYWORDS[domain]) if (normalized.includes(keyword)) score += 2;
    }
    for (const cue of entry.observableCues) if (normalized.includes(cue.toLowerCase())) score += 3;
    if (entry.regions.includes('UNIVERSAL')) score += 0.25;
    return { entry, score };
  });
  const matched = scored.filter(x => x.score > 0).sort((a,b) => b.score - a.score).map(x => x.entry);
  const fallback = BOXING_KNOWLEDGE.filter(x => ['kinetic-chain-before-arm-only-power','guard-recovery-after-offense','movement-is-defense-and-offense','effective-pressure-not-forward-only','individualize-style'].includes(x.id));
  return Array.from(new Map([...matched, ...fallback].map(x => [x.id, x])).values()).slice(0, limit);
}

export function boxingKnowledgePrompt(input: string, limit = 8) {
  const entries = retrieveBoxingKnowledge(input, limit);
  const lines = entries.map((entry) => {
    const provenance = entry.sourceIds.map(id => `${id}:${BOXING_KNOWLEDGE_SOURCES[id].kind}`).join(', ');
    return `- [${entry.id}] ${entry.title}. Señales observables: ${entry.observableCues.join('; ')}. Consecuencia: ${entry.consequence} Corrección candidata: ${entry.correction} Drill: ${entry.drill} Fuentes: ${provenance}.`;
  });
  return {
    version: BOXING_KNOWLEDGE_VERSION,
    ids: entries.map(x => x.id),
    sourceIds: Array.from(new Set(entries.flatMap(x => x.sourceIds))),
    text: [
      `Fight AI Hybrid Knowledge Base ${BOXING_KNOWLEDGE_VERSION}:`,
      ...lines,
      'REGLA DE EVIDENCIA: la base no diagnostica. Cada corrección es una hipótesis que debe confirmarse con observación visible del video. Las fuentes académicas apoyan biomecánica/fisiología general; no autorizan inventar métricas, fatiga o puntuación del atleta. Si el video contradice la base, prevalece el video.',
      'REGLA DE SCORING: usa criterios de puntuación solo para explicar valor táctico observable. No declares quién ganó un round salvo que el análisis tenga evidencia suficiente y el producto pida explícitamente una evaluación de scoring.',
      'REGLA DE ESTILO: no atribuyas una conducta a nacionalidad, país o “escuela” como estereotipo. Describe únicamente patrones observados en este atleta y este rival.',
    ].join('\n'),
  };
}
