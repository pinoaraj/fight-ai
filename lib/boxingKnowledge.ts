export type BoxingKnowledgeRegion = 'UNIVERSAL' | 'USA' | 'UK' | 'RESEARCH';
export type BoxingKnowledgeDomain =
  | 'STANCE' | 'GUARD' | 'FOOTWORK' | 'DISTANCE' | 'OFFENSE' | 'DEFENSE'
  | 'COUNTERING' | 'ENTRY' | 'EXIT' | 'FEINTS' | 'BALANCE' | 'TACTICS' | 'BODY_ATTACK';

export type BoxingKnowledgeSource = {
  authority: string;
  url: string;
  kind: 'official_coaching' | 'peer_reviewed';
  evidence: 'coaching_standard' | 'systematic_review' | 'elite_biomechanics' | 'biomechanics';
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

export const BOXING_KNOWLEDGE_VERSION = '2026.09.04-v2';

// Hybrid provenance policy:
// - Official boxing bodies define coachable technical/tactical fundamentals.
// - Peer-reviewed university / institute research supports biomechanical claims.
// - Research never creates a diagnosis by itself; the video must show the cue.
// - National labels are not used as technique stereotypes.
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
  TACTICS: ['strategy','estrategia','táctica','rival'],
  BODY_ATTACK: ['body','cuerpo','hígado','corta distancia'],
};

export function retrieveBoxingKnowledge(input: string, limit = 7) {
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
  const fallback = BOXING_KNOWLEDGE.filter(x => ['kinetic-chain-before-arm-only-power','guard-recovery-after-offense','movement-is-defense-and-offense','individualize-style'].includes(x.id));
  return Array.from(new Map([...matched, ...fallback].map(x => [x.id, x])).values()).slice(0, limit);
}

export function boxingKnowledgePrompt(input: string, limit = 7) {
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
      'REGLA DE EVIDENCIA: la base no diagnostica. Cada corrección es una hipótesis que debe confirmarse con observación visible del video. Las fuentes académicas apoyan biomecánica general; no autorizan inventar métricas del atleta. Si el video contradice la base, prevalece el video.',
      'REGLA DE ESTILO: no atribuyas una conducta a nacionalidad, país o “escuela” como estereotipo. Describe únicamente patrones observados en este atleta y este rival.',
    ].join('\n'),
  };
}
