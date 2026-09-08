export type TargetIdentityContext = {
  gloveColor: string;
  topColor: string;
  fighterNotes: string;
  anchorX: string;
  anchorY: string;
  anchorSize: string;
  anchorTime: string;
};

export type TargetIdentity = {
  requestedGloves: string;
  observedGloves: string;
  anchorMatch: 'confirmed' | 'uncertain' | 'conflict';
  confidence: number;
  notes: string;
};

export type IdentityEvidence = {
  time: string;
  title: string;
  observation: string;
  correction: string;
  targetMatch: boolean;
};

export const targetIdentitySchema = {
  type: 'object',
  properties: {
    requestedGloves: { type: 'string' },
    observedGloves: { type: 'string' },
    anchorMatch: { type: 'string', enum: ['confirmed', 'uncertain', 'conflict'] },
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['requestedGloves', 'observedGloves', 'anchorMatch', 'confidence', 'notes'],
};

const COLOR_ALIASES: Record<string, string[]> = {
  red: ['red', 'rojo', 'roja', 'rojos', 'rojas'],
  blue: ['blue', 'azul', 'azules'],
  white: ['white', 'blanco', 'blanca', 'blancos', 'blancas'],
  black: ['black', 'negro', 'negra', 'negros', 'negras'],
  green: ['green', 'verde', 'verdes'],
  yellow: ['yellow', 'amarillo', 'amarilla', 'amarillos', 'amarillas'],
  gold: ['gold', 'golden', 'oro', 'dorado', 'dorada', 'dorados', 'doradas'],
  orange: ['orange', 'naranja'],
  purple: ['purple', 'violet', 'morado', 'morada', 'violeta'],
  pink: ['pink', 'rosado', 'rosada', 'rosa'],
  gray: ['gray', 'grey', 'gris', 'grises'],
  brown: ['brown', 'marron', 'cafe'],
};

function normalizedWords(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function colorsIn(value: string) {
  const words = new Set(normalizedWords(value));
  return new Set(Object.entries(COLOR_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => words.has(alias)))
    .map(([color]) => color));
}

function hasAnchor(context: TargetIdentityContext) {
  if (!context.anchorX.trim() || !context.anchorY.trim()) return false;
  const x = Number(context.anchorX);
  const y = Number(context.anchorY);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

export function identityInstruction(context: TargetIdentityContext, offset = 0, duration = 180) {
  const anchorTime = Number(context.anchorTime);
  const anchorAvailable = hasAnchor(context) && Number.isFinite(anchorTime);
  const withinSegment = anchorAvailable && anchorTime >= offset && anchorTime < offset + duration;
  const localAnchor = withinSegment ? Math.max(0, anchorTime - offset) : null;
  const anchor = anchorAvailable
    ? `El usuario marcó al atleta objetivo en el video original en t=${anchorTime.toFixed(1)}s, x=${Number(context.anchorX).toFixed(1)}%, y=${Number(context.anchorY).toFixed(1)}%, círculo=${Number(context.anchorSize || 24).toFixed(1)}%. ${withinSegment ? `En este segmento esa ancla aparece aproximadamente en t=${localAnchor?.toFixed(1)}s.` : 'El momento del ancla queda fuera de este segmento; conserva la misma identidad usando los rasgos declarados y continuidad temporal, y declara baja confianza si no puedes confirmarla.'}`
    : 'No existe ancla de coordenadas válida; identifica al atleta únicamente con los rasgos declarados y declara baja confianza si son ambiguos.';
  return `${anchor}\nNo intercambies atleta y rival aunque cambien de lado. targetIdentity debe declarar requestedGloves exactamente como fue solicitado, observedGloves según lo realmente visible, anchorMatch como confirmed, uncertain o conflict, confidence entre 0 y 1 y notes con la base visual de la decisión. Usa confirmed solo cuando la continuidad con el atleta marcado y sus rasgos sea consistente. En cada evidence, targetMatch solo puede ser true si el momento corresponde al atleta objetivo. Omite evidencia dudosa.`;
}

export function parseTargetIdentity(raw: unknown, context: TargetIdentityContext): TargetIdentity | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const confidence = Number(item.confidence);
  const anchorMatch = item.anchorMatch;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (anchorMatch !== 'confirmed' && anchorMatch !== 'uncertain' && anchorMatch !== 'conflict') return null;
  const identity: TargetIdentity = {
    requestedGloves: context.gloveColor.trim() || (typeof item.requestedGloves === 'string' ? item.requestedGloves.trim() : ''),
    observedGloves: typeof item.observedGloves === 'string' ? item.observedGloves.trim() : '',
    anchorMatch,
    confidence,
    notes: typeof item.notes === 'string' ? item.notes.trim() : '',
  };
  if (!identity.notes || confidence < 0.6 || identity.anchorMatch === 'conflict') return null;
  if (hasAnchor(context) && identity.anchorMatch !== 'confirmed') return null;
  if (context.gloveColor.trim()) {
    const echoedRequestedGloves = typeof item.requestedGloves === 'string' ? item.requestedGloves.trim() : '';
    if (!echoedRequestedGloves || !identity.observedGloves) return null;
    const requested = colorsIn(context.gloveColor);
    const echoedRequest = colorsIn(echoedRequestedGloves);
    const observed = colorsIn(identity.observedGloves);
    if (requested.size && echoedRequest.size && ![...requested].some(color => echoedRequest.has(color))) return null;
    if (requested.size && observed.size && ![...requested].some(color => observed.has(color))) return null;
    if (!requested.size || !observed.size) {
      const requestedWords = new Set(normalizedWords(context.gloveColor).filter(word => word.length > 2));
      const observedWords = new Set(normalizedWords(identity.observedGloves));
      if (requestedWords.size && ![...requestedWords].some(word => observedWords.has(word))) return null;
    }
  }
  return identity;
}

export function parseIdentityEvidence(raw: unknown): IdentityEvidence | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const evidence = {
    time: typeof item.time === 'string' ? item.time : '00:00',
    title: typeof item.title === 'string' ? item.title : 'Evidencia',
    observation: typeof item.observation === 'string' ? item.observation : '',
    correction: typeof item.correction === 'string' ? item.correction : '',
    targetMatch: item.targetMatch === true,
  };
  return /^\d{1,2}:\d{2}$/.test(evidence.time) && evidence.observation && evidence.targetMatch ? evidence : null;
}
