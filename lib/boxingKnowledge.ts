export type BoxingKnowledgeRegion = 'UNIVERSAL' | 'USA' | 'RUSSIA' | 'MEXICO' | 'CUBA' | 'UK';
export type BoxingKnowledgeDomain =
  | 'STANCE' | 'GUARD' | 'FOOTWORK' | 'DISTANCE' | 'OFFENSE' | 'DEFENSE'
  | 'COUNTERING' | 'ENTRY' | 'EXIT' | 'FEINTS' | 'BALANCE' | 'TACTICS' | 'BODY_ATTACK';

export type BoxingKnowledgeEntry = {
  id: string;
  title: string;
  domains: BoxingKnowledgeDomain[];
  regions: BoxingKnowledgeRegion[];
  observableCues: string[];
  consequence: string;
  correction: string;
  drill: string;
  sourceIds: string[];
};

export const BOXING_KNOWLEDGE_VERSION = '2026.09.02-v1';

export const BOXING_KNOWLEDGE_SOURCES = {
  IBA_COACH_MANUAL: {
    authority: 'International Boxing Association (IBA) Coaches Manual',
    url: 'https://www.iba.sport/documents/iba-coach-manual/',
    note: 'Includes standardized technique/tactics plus advanced Russia and USA sections.',
  },
  USA_BOXING_EDU: {
    authority: 'USA Boxing Coaching Education',
    url: 'https://www.usaboxing.org/coach',
    note: 'USA Boxing coach pathway covering fundamentals, advanced skills, strategy and film study.',
  },
  ENGLAND_BOXING_HANDBOOK: {
    authority: 'England Boxing Coaching Handbook',
    url: 'https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf',
    note: 'Technique-to-skill progression with offence, defence, movement and countering.',
  },
  RUSSIAN_BOXING_FEDERATION: {
    authority: 'Russian Boxing Federation',
    url: 'https://rusboxing.ru/about/documents',
    note: 'Federation development/rules documents; Russian-specific technique references are cross-checked against the IBA Coaches Manual.',
  },
  FMB_COACH_PROGRAM: {
    authority: 'Federación Mexicana de Boxeo — Programa de Capacitación de Entrenadores',
    url: 'https://federacionmexicanadeboxeo.org/',
    note: 'Mexican coach-development provenance. Tradition tags are used as references, never stereotypes.',
  },
} as const;

export const BOXING_KNOWLEDGE: BoxingKnowledgeEntry[] = [
  {
    id: 'guard-recovery-after-offense',
    title: 'Recuperación de guardia después de atacar',
    domains: ['GUARD','DEFENSE','EXIT'],
    regions: ['UNIVERSAL','USA','MEXICO'],
    observableCues: ['mano tarda en volver', 'queda abierto después de combinar', 'salida sin guardia'],
    consequence: 'La ventana de contraataque aumenta justo cuando el atacante termina su combinación.',
    correction: 'Recuperar manos y postura durante el último golpe y ligar inmediatamente una salida o defensa.',
    drill: 'Combinación de 2–3 golpes → guardia completa → salida 45°; 3×2 min.',
    sourceIds: ['IBA_COACH_MANUAL','USA_BOXING_EDU','FMB_COACH_PROGRAM'],
  },
  {
    id: 'base-before-power',
    title: 'Base estable antes de transferir potencia',
    domains: ['STANCE','BALANCE','OFFENSE'],
    regions: ['UNIVERSAL','RUSSIA','USA'],
    observableCues: ['torso llega antes que pies', 'sobreextensión', 'cruza pies al golpear', 'pierde balance'],
    consequence: 'Reduce control, retrasa la recuperación y facilita el contraataque.',
    correction: 'Cerrar distancia con la base primero y transferir peso sin sacar la cabeza fuera del soporte de los pies.',
    drill: 'Step-jab y 1–2 con pausa de balance; confirmar postura después de cada combinación.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_HANDBOOK'],
  },
  {
    id: 'movement-is-defense-and-offense',
    title: 'Movimiento integrado a ataque y defensa',
    domains: ['FOOTWORK','DEFENSE','OFFENSE','EXIT'],
    regions: ['UNIVERSAL','RUSSIA','UK'],
    observableCues: ['ataca estático', 'defiende sin reposicionarse', 'permanece en línea después de golpear'],
    consequence: 'El rival recibe una segunda oportunidad de ataque y puede predecir la posición final.',
    correction: 'Terminar acciones con ajuste de distancia, paso lateral o pivote en vez de quedar fijo.',
    drill: 'Jab → paso lateral; 1–2 → pivote; defensa → contra → salida.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_HANDBOOK'],
  },
  {
    id: 'defense-creates-counter',
    title: 'La defensa debe crear una respuesta',
    domains: ['DEFENSE','COUNTERING','TACTICS'],
    regions: ['UNIVERSAL','USA','UK'],
    observableCues: ['bloquea y no responde', 'slip sin contra', 'cede iniciativa después de defender'],
    consequence: 'Una defensa correcta no cambia el intercambio si el rival puede reiniciar sin coste.',
    correction: 'Relacionar cada defensa frecuente con una respuesta simple y segura.',
    drill: 'Parry-jab, slip-cross y block-hook en rondas técnicas de reacción.',
    sourceIds: ['ENGLAND_BOXING_HANDBOOK','USA_BOXING_EDU'],
  },
  {
    id: 'range-before-combination',
    title: 'Ganar distancia antes de combinar',
    domains: ['DISTANCE','ENTRY','OFFENSE'],
    regions: ['UNIVERSAL','RUSSIA','USA'],
    observableCues: ['golpea desde demasiado lejos', 'se inclina para alcanzar', 'entra sin jab o finta'],
    consequence: 'La combinación pierde precisión y el peleador entra expuesto.',
    correction: 'Usar jab, finta o paso corto para ocupar la distancia antes de soltar golpes de potencia.',
    drill: 'Finta → paso corto → jab al pecho → 2; 3×2 min.',
    sourceIds: ['IBA_COACH_MANUAL','USA_BOXING_EDU'],
  },
  {
    id: 'exit-off-centerline',
    title: 'Salir fuera de la línea central',
    domains: ['EXIT','FOOTWORK','DEFENSE'],
    regions: ['UNIVERSAL','USA','RUSSIA'],
    observableCues: ['retrocede recto después de combinar', 'queda frente al rival', 'misma línea de entrada y salida'],
    consequence: 'El rival puede responder con golpes rectos o perseguir sin reajustar.',
    correction: 'Incluir un ángulo pequeño al final de la combinación y conservar postura para defender.',
    drill: '1–2–3 → pivote; 1–2 → paso 45°; cuerda o marcas de piso para salida.',
    sourceIds: ['IBA_COACH_MANUAL','ENGLAND_BOXING_HANDBOOK'],
  },
  {
    id: 'feint-to-read',
    title: 'Finta para leer antes de comprometerse',
    domains: ['FEINTS','ENTRY','TACTICS'],
    regions: ['UNIVERSAL','RUSSIA','USA'],
    observableCues: ['entra siempre con la misma primera acción', 'rival anticipa el jab', 'ataques predecibles'],
    consequence: 'El rival puede preparar defensas y contras con menos incertidumbre.',
    correction: 'Usar fintas pequeñas para provocar una reacción y atacar la respuesta observada.',
    drill: 'Finta de jab → leer guardia/paso → elegir cabeza, cuerpo o salida.',
    sourceIds: ['IBA_COACH_MANUAL','USA_BOXING_EDU'],
  },
  {
    id: 'body-work-from-reaction',
    title: 'Trabajo al cuerpo condicionado por la reacción',
    domains: ['BODY_ATTACK','OFFENSE','TACTICS'],
    regions: ['UNIVERSAL','MEXICO','USA'],
    observableCues: ['guardia alta bajo presión', 'codos se abren', 'rival se fija al cubrir cabeza'],
    consequence: 'Atacar el cuerpo sin crear la apertura puede exponer al atacante; condicionar la guardia mejora la entrada.',
    correction: 'Crear primero una reacción arriba y usar el cuerpo cuando la apertura sea visible.',
    drill: 'Jab/cross a guardia → hook al cuerpo → salida; controlar potencia.',
    sourceIds: ['IBA_COACH_MANUAL','FMB_COACH_PROGRAM'],
  },
  {
    id: 'individualize-style',
    title: 'Individualizar el fundamento al atleta',
    domains: ['TACTICS','STANCE','FOOTWORK'],
    regions: ['UNIVERSAL','RUSSIA','USA','MEXICO'],
    observableCues: ['técnica funciona solo en ciertos contextos', 'atributos físicos cambian la solución', 'rival obliga adaptación'],
    consequence: 'Aplicar una plantilla rígida puede empeorar una mecánica que sí funciona para ese atleta.',
    correction: 'Usar el fundamento como referencia y validar la corrección contra el video, rival, guardia, alcance y equilibrio del atleta.',
    drill: 'Repetir la misma situación con 2 soluciones y conservar la que mantiene balance, defensa y control.',
    sourceIds: ['IBA_COACH_MANUAL','USA_BOXING_EDU'],
  },
];

const DOMAIN_KEYWORDS: Record<BoxingKnowledgeDomain, string[]> = {
  STANCE: ['stance','guardia','postura'],
  GUARD: ['guard','guardia','hands','manos'],
  FOOTWORK: ['footwork','pies','movimiento','pivot','pivote'],
  DISTANCE: ['distance','distancia','range','timing'],
  OFFENSE: ['offense','ofensiva','ataque','golpe'],
  DEFENSE: ['defense','defensa','slip','bloque','parry'],
  COUNTERING: ['counter','contra','respuesta'],
  ENTRY: ['entry','entrada','entrar','cerrar distancia'],
  EXIT: ['exit','salida','salir','ángulo','angle'],
  FEINTS: ['feint','finta'],
  BALANCE: ['balance','equilibrio','base'],
  TACTICS: ['strategy','estrategia','táctica','rival'],
  BODY_ATTACK: ['body','cuerpo','hígado'],
};

export function retrieveBoxingKnowledge(input: string, limit = 6) {
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
  const fallback = BOXING_KNOWLEDGE.filter(x => ['base-before-power','guard-recovery-after-offense','movement-is-defense-and-offense','individualize-style'].includes(x.id));
  return Array.from(new Map([...matched, ...fallback].map(x => [x.id, x])).values()).slice(0, limit);
}

export function boxingKnowledgePrompt(input: string, limit = 6) {
  const entries = retrieveBoxingKnowledge(input, limit);
  const lines = entries.map((entry) =>
    `- [${entry.id}] ${entry.title}. Señales: ${entry.observableCues.join('; ')}. Consecuencia: ${entry.consequence} Corrección: ${entry.correction} Drill: ${entry.drill}`
  );
  return {
    version: BOXING_KNOWLEDGE_VERSION,
    ids: entries.map(x => x.id),
    text: [
      `Fight AI Knowledge Base ${BOXING_KNOWLEDGE_VERSION}:`,
      ...lines,
      'REGLA: estos fundamentos son hipótesis/referencias. Valida cada uno contra el video del atleta y descarta cualquier fundamento que no esté respaldado por evidencia visible. No conviertas regiones o escuelas en estereotipos.',
    ].join('\n'),
  };
}
