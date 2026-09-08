import type { BoxingKnowledgeDomain } from './boxingKnowledge';

export type BoxingProgramKind =
  | 'university_research_program'
  | 'governing_body_education'
  | 'high_performance_institute'
  | 'boxing_academy';

export type BoxingProgramEvidenceTier =
  | 'peer_reviewed_research_context'
  | 'official_curriculum'
  | 'official_program_profile'
  | 'institutional_profile_only';

export type BoxingProgramCatalogEntry = {
  id: string;
  name: string;
  kind: BoxingProgramKind;
  country: string;
  officialUrl: string;
  verifiedAt: string;
  evidenceTier: BoxingProgramEvidenceTier;
  domains: BoxingKnowledgeDomain[];
  documentedRole: string;
  allowedPromptUse: string;
  limitations: string[];
  linkedKnowledgeIds: string[];
  linkedSourceIds: string[];
  retrievalTerms: string[];
};

export const BOXING_PROGRAM_CATALOG_VERSION = '2026.09.07-v1';

// This catalog records institutional provenance and documented program roles.
// Inclusion is not a ranking or an endorsement. A gym/program name is never
// evidence that a Fight AI athlete shows a particular technique or style.
export const BOXING_PROGRAM_CATALOG: BoxingProgramCatalogEntry[] = [
  {
    id: 'ljmu-rises',
    name: 'Liverpool John Moores University — Research Institute for Sport and Exercise Sciences',
    kind: 'university_research_program',
    country: 'United Kingdom',
    officialUrl: 'https://www.ljmu.ac.uk/research/centres-and-institutes/research-institute-for-sport-and-exercise-sciences',
    verifiedAt: '2026-09-07',
    evidenceTier: 'peer_reviewed_research_context',
    domains: ['BALANCE', 'OFFENSE', 'STANCE', 'FATIGUE'],
    documentedRole: 'Multidisciplinary sport-and-exercise research environment with biomechanics, coaching and performance expertise.',
    allowedPromptUse: 'Provide provenance context for already-selected biomechanics and whole-body coordination principles.',
    limitations: ['The institutional profile is not athlete-specific evidence.', 'Use linked peer-reviewed sources for scientific claims.'],
    linkedKnowledgeIds: ['kinetic-chain-before-arm-only-power', 'late-round-kinetic-chain-preservation', 'individualize-style'],
    linkedSourceIds: ['INSEP_LJMU_ELITE_PUNCHING'],
    retrievalTerms: ['biomecánica', 'biomechanics', 'cadena cinética', 'kinetic chain', 'coordinación', 'coordination'],
  },
  {
    id: 'edge-hill-combat-sports-research',
    name: 'Edge Hill University — Physical Performance Profiling of Combat Sports',
    kind: 'university_research_program',
    country: 'United Kingdom',
    officialUrl: 'https://www.edgehill.ac.uk/departments/academic/sport/research/spep-research-group/physical-performance-profiling-of-combat-sports/',
    verifiedAt: '2026-09-07',
    evidenceTier: 'peer_reviewed_research_context',
    domains: ['FATIGUE', 'BALANCE', 'OFFENSE'],
    documentedRole: 'Applied combat-sports research covering physiological and mechanical demands, punch-force assessment and training interventions.',
    allowedPromptUse: 'Provide research-program context for cautious conditioning, fatigue and punching-mechanics hypotheses.',
    limitations: ['Do not infer fatigue from clock time.', 'Do not invent force, physiology or performance measurements.'],
    linkedKnowledgeIds: ['fatigue-must-be-visible-not-assumed', 'late-round-kinetic-chain-preservation'],
    linkedSourceIds: ['BOXING_ACUTE_RESPONSES_REVIEW', 'LOWER_BODY_FATIGUE_PUNCHING'],
    retrievalTerms: ['fatiga', 'fatigue', 'condicionamiento', 'conditioning', 'fisiología', 'physiology', 'punch force'],
  },
  {
    id: 'insep-performance-research',
    name: 'INSEP — Institut national du sport, de l’expertise et de la performance',
    kind: 'high_performance_institute',
    country: 'France',
    officialUrl: 'https://www.insep.fr/en',
    verifiedAt: '2026-09-07',
    evidenceTier: 'peer_reviewed_research_context',
    domains: ['BALANCE', 'OFFENSE', 'STANCE'],
    documentedRole: 'National high-performance institute combining athlete support, expertise and sport-performance research.',
    allowedPromptUse: 'Provide high-performance research provenance for whole-body synchronization and individual variability.',
    limitations: ['Do not present an institute association as proof of a visible diagnosis.', 'Do not transfer findings without video confirmation.'],
    linkedKnowledgeIds: ['kinetic-chain-before-arm-only-power', 'individualize-style'],
    linkedSourceIds: ['INSEP_LJMU_ELITE_PUNCHING'],
    retrievalTerms: ['élite', 'elite', 'alto rendimiento', 'high performance', 'sincronización', 'synchronization'],
  },
  {
    id: 'usa-boxing-coach-education',
    name: 'USA Boxing — Coach Education',
    kind: 'governing_body_education',
    country: 'United States',
    officialUrl: 'https://www.usaboxing.org/coach',
    verifiedAt: '2026-09-07',
    evidenceTier: 'official_curriculum',
    domains: ['STANCE', 'GUARD', 'FOOTWORK', 'DEFENSE', 'OFFENSE', 'TACTICS'],
    documentedRole: 'Official coach-education pathway and educational platform for boxing coaches.',
    allowedPromptUse: 'Provide coach-education context for teaching progressions already supported by visible evidence.',
    limitations: ['Do not imply certification or endorsement by USA Boxing.', 'Do not describe a national style.'],
    linkedKnowledgeIds: ['guard-recovery-after-offense', 'movement-is-defense-and-offense', 'defense-creates-counter', 'feint-to-read', 'individualize-style'],
    linkedSourceIds: ['USA_BOXING_EDUCATION'],
    retrievalTerms: ['coach education', 'formación de entrenadores', 'progresión', 'teaching progression', 'fundamentos'],
  },
  {
    id: 'england-boxing-coach-education',
    name: 'England Boxing — Coach Education',
    kind: 'governing_body_education',
    country: 'United Kingdom',
    officialUrl: 'https://www.englandboxing.org/coach-education/',
    verifiedAt: '2026-09-07',
    evidenceTier: 'official_curriculum',
    domains: ['STANCE', 'GUARD', 'FOOTWORK', 'DISTANCE', 'DEFENSE', 'OFFENSE'],
    documentedRole: 'Official staged coach-education system with competency and continuing-development requirements.',
    allowedPromptUse: 'Provide curriculum context for fundamentals, movement and progressive drill design.',
    limitations: ['Do not imply certification or endorsement by England Boxing.', 'Do not treat curriculum context as athlete-specific evidence.'],
    linkedKnowledgeIds: ['guard-recovery-after-offense', 'base-before-reaching', 'movement-is-defense-and-offense', 'defense-creates-counter', 'range-before-combination', 'exit-off-centerline'],
    linkedSourceIds: ['ENGLAND_BOXING_L1'],
    retrievalTerms: ['coach education', 'formación de entrenadores', 'drill', 'fundamentos', 'footwork', 'distancia'],
  },
  {
    id: 'gb-boxing-world-class-programme',
    name: 'GB Boxing — World Class Programme',
    kind: 'high_performance_institute',
    country: 'United Kingdom',
    officialUrl: 'https://gbboxing.org.uk/how-to-be-a-gb-boxer/',
    verifiedAt: '2026-09-07',
    evidenceTier: 'official_program_profile',
    domains: ['TACTICS', 'RINGCRAFT', 'SCORING', 'FATIGUE'],
    documentedRole: 'Documented Olympic-boxing performance pathway with boxer development and assessment guidance.',
    allowedPromptUse: 'Provide high-performance pathway context for structured development goals and progress review.',
    limitations: ['Do not claim Fight AI reproduces GB Boxing assessment.', 'Do not infer Olympic potential or selection readiness.'],
    linkedKnowledgeIds: ['effective-pressure-not-forward-only', 'ring-control-through-position-and-rhythm', 'scoring-quality-before-volume-assumption', 'individualize-style'],
    linkedSourceIds: [],
    retrievalTerms: ['desarrollo', 'development', 'pathway', 'alto rendimiento', 'high performance', 'objetivos de sesión'],
  },
  {
    id: 'gleasons-gym',
    name: "Gleason's Gym",
    kind: 'boxing_academy',
    country: 'United States',
    officialUrl: 'https://www.gleasonsgym.com/',
    verifiedAt: '2026-09-07',
    evidenceTier: 'institutional_profile_only',
    domains: ['OFFENSE', 'DEFENSE', 'TACTICS'],
    documentedRole: 'Long-running boxing gym whose official profile documents professional, amateur and recreational training.',
    allowedPromptUse: 'Acknowledge an example of an established boxing training environment only when institutional context is explicitly requested.',
    limitations: ['History and reputation are not scientific evidence.', 'Do not copy or invent a Gleason’s methodology.', 'No ranking or endorsement.'],
    linkedKnowledgeIds: [],
    linkedSourceIds: [],
    retrievalTerms: ["gleason's", 'gleasons', 'academia', 'academy', 'gym', 'gimnasio'],
  },
  {
    id: 'wild-card-boxing-club',
    name: 'Wild Card Boxing Club',
    kind: 'boxing_academy',
    country: 'United States',
    officialUrl: 'https://wildcardboxing.com/pages/about-us',
    verifiedAt: '2026-09-07',
    evidenceTier: 'institutional_profile_only',
    domains: ['OFFENSE', 'DEFENSE', 'TACTICS'],
    documentedRole: 'Boxing club whose official profile documents its trainer-led professional and developing-boxer environment.',
    allowedPromptUse: 'Acknowledge an example of an established boxing training environment only when institutional context is explicitly requested.',
    limitations: ['The official profile contains promotional claims, not peer-reviewed evidence.', 'Do not copy or invent a Wild Card methodology.', 'No ranking or endorsement.'],
    linkedKnowledgeIds: [],
    linkedSourceIds: [],
    retrievalTerms: ['wild card', 'freddie roach', 'academia', 'academy', 'gym', 'gimnasio'],
  },
];

export function retrieveBoxingPrograms(input: string, knowledgeIds: string[] = [], limit = 3) {
  const normalized = input.toLowerCase();
  const selectedKnowledge = new Set(knowledgeIds);
  return BOXING_PROGRAM_CATALOG
    .map((program) => {
      const knowledgeScore = program.linkedKnowledgeIds.filter(id => selectedKnowledge.has(id)).length * 4;
      const termScore = program.retrievalTerms.filter(term => normalized.includes(term.toLowerCase())).length * 2;
      return { program, score: knowledgeScore + termScore };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.program.id.localeCompare(b.program.id))
    .slice(0, Math.max(0, limit))
    .map(item => item.program);
}

export function boxingProgramCatalogPrompt(input: string, knowledgeIds: string[] = [], limit = 3) {
  const programs = retrieveBoxingPrograms(input, knowledgeIds, limit);
  if (!programs.length) return { version: BOXING_PROGRAM_CATALOG_VERSION, ids: [], text: '' };
  const lines = programs.map(program =>
    `- [${program.id}] ${program.name} (${program.evidenceTier}). Rol documentado: ${program.documentedRole} Uso permitido: ${program.allowedPromptUse}`
  );
  return {
    version: BOXING_PROGRAM_CATALOG_VERSION,
    ids: programs.map(program => program.id),
    text: [
      `CATÁLOGO INSTITUCIONAL ${BOXING_PROGRAM_CATALOG_VERSION} (contexto, no ranking):`,
      ...lines,
      'LÍMITE INSTITUCIONAL: un nombre, reputación o programa no diagnostica al atleta y no reemplaza evidencia visible. No afirmes afiliación, certificación, endorsement ni una metodología institucional no documentada. No ordenes instituciones por prestigio y no atribuyas estilos a países.',
    ].join('\n'),
  };
}
