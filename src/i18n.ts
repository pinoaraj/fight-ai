import type {Language} from './types';

export const copy = {
  es: {
    appName:'AI Sparring Analyst',
    beta:'Beta móvil', home:'Inicio', sessions:'Sesiones', analyze:'Analizar', progress:'Progreso', profile:'Perfil',
    ready:'¿Listo', review:'Revisa tu sparring, detecta hábitos repetidos y define el siguiente objetivo de entrenamiento.',
    analyzeSparring:'Analizar sparring', latestSession:'Última sesión', viewAnalysis:'Ver análisis', noCompleted:'Aún no hay sesiones completadas',
    noCompletedBody:'Elige un video de sparring para probar el flujo completo.', betaPrinciples:'Principios de la beta',
    noFakeStats:'Sin porcentajes inventados', confidenceShown:'Las observaciones muestran nivel de confianza', onlyThree:'Solo tres prioridades principales por sesión',
    analysis:'Análisis de sesión', back:'Volver', mockNotice:'Beta Combat Engine · reglas y base técnica reales · evidencia de video aún simulada · los timestamps son interactivos. Valida hallazgos importantes con tu entrenador.',
    mainTakeaway:'Idea principal', strengths:'Fortalezas detectadas', priorities:'Prioridades principales', nextPlan:'Plan para el próximo sparring', timeline:'Timeline inteligente',
    fightStrategy:'Estrategia de pelea', rematch:'Estrategia para revancha', drills:'Drills', safety:'Seguridad',
    safetyBody:'El análisis de IA puede equivocarse y no reemplaza a un entrenador ni entrega autorización médica. No uses la app para diagnosticar conmociones o lesiones.',
    confidence:'confianza', tapSeek:'toca para ir al momento', visualExamples:'Ejemplos visuales', visualHint:'Modelos simples para convertir el análisis en acciones concretas.',
    createProfile:'Crea un perfil beta local. En esta versión el video queda en tu dispositivo.', name:'Nombre', email:'Correo', stance:'Guardia', experience:'Experiencia', enterBeta:'Entrar a la beta',
    language:'Idioma', spanish:'Español', english:'English', chooseVideo:'Elegir video MP4/MOV', chooseSport:'Deporte', fighter:'¿Cuál peleador eres?', left:'Izquierda', right:'Derecha',
    rounds:'Rounds (opcional)', intensity:'Intensidad', description:'Descripción opcional: polera negra, guantes rojos…', goal:'Objetivo de entrenamiento (opcional)', notes:'Notas (opcional)', start:'Iniciar análisis',
    processing:'Revisando tu sparring', processingNote:'CV + pose analizan el video real; Video IA puede revisar clips ralentizados cuando está configurado. El reporte solo eleva hallazgos con evidencia suficiente.',
    preparing:'Preparando video', identifying:'Identificando peleador', exchanges:'Revisando intercambios', patterns:'Detectando patrones', report:'Generando reporte',
    progressTitle:'Progreso', progressBody:'Esta beta evita métricas falsas. Cuando existan varias sesiones, aquí mostraremos cambios cualitativos y mediciones solo cuando sean confiables.',
    qualitative:'Indicadores cualitativos preparados', lateral:'Salidas laterales', postCombo:'Defensa post-combinación', jabVariety:'Variedad del jab', ringControl:'Control del ring',
    profileTitle:'Perfil', reset:'Borrar datos locales', tester:'Probador móvil', iosAndroid:'Android + iOS', platformBody:'El mismo código está configurado para Expo Go en Android y iPhone.',
    noSessions:'Todavía no hay sesiones.', completed:'COMPLETADO', processingStatus:'PROCESANDO', selectedVideo:'Video seleccionado',
    version:'Versión 0.13.0 QA', aiEngine:'Motor de IA', aiProviderTitle:'Proveedor de análisis', aiProviderBody:'La beta usa CV + pose en tu PC y puede sumar Video IA mediante el servidor. La arquitectura mantiene proveedores intercambiables.', managedAi:'IA de la app', managedAiBody:'Recomendado: la app administra el proveedor, costos y seguridad de claves. En la beta cloud será la opción por defecto.', byokBody:'BYOK futuro: requerirá una API key del proveedor. Una suscripción ChatGPT/Claude/Gemini de consumidor no equivale necesariamente a créditos API.', visualCoach:'Coach visual', patternMap:'Mapa de patrones', patternMapBody:'Prioriza comportamientos repetidos sobre números aislados.',
    reviewType:'Tipo de revisión', sparringReview:'Sparring completo', techniqueReview:'Revisión técnica', reviewFocus:'Qué quieres priorizar', fullReview:'Análisis completo', offenseReview:'Ataque', defenseReview:'Defensa', footworkReview:'Footwork', combinationsReview:'Combinaciones', strategyReview:'Estrategia', techniqueFocus:'Técnica', combatEngine:'Combat Engine', combatEngineBody:'La base técnica y el motor de reglas funcionan sin depender de un LLM. La evidencia viene del video real mediante CV + pose y, cuando está configurado, Video IA sobre clips candidatos ralentizados.', evidence:'Evidencia del motor', rulesMatched:'Reglas activadas', knowledgeBase:'Base técnica', evidenceBeta:'Evidencia real de CV/pose; Video IA solo si supera los filtros',
  },
  en: {
    appName:'AI Sparring Analyst', beta:'Mobile beta', home:'Home', sessions:'Sessions', analyze:'Analyze', progress:'Progress', profile:'Profile',
    ready:'Ready', review:'Review sparring, spot recurring habits and define the next training focus.', analyzeSparring:'Analyze Sparring', latestSession:'Latest session', viewAnalysis:'View Analysis',
    noCompleted:'No completed session yet', noCompletedBody:'Choose a sparring video to test the full flow.', betaPrinciples:'Beta principles', noFakeStats:'No fabricated percentages',
    confidenceShown:'Confidence is shown for observations', onlyThree:'Only three main priorities per session', analysis:'Session analysis', back:'Back',
    mockNotice:'Combat Engine beta · real rules and knowledge base · video evidence still simulated · timestamps are interactive. Verify important findings with your coach.', mainTakeaway:'Main takeaway', strengths:'Detected strengths', priorities:'Main priorities',
    nextPlan:'Next sparring plan', timeline:'Smart timeline', fightStrategy:'Fight strategy', rematch:'Rematch strategy', drills:'Drills', safety:'Safety',
    safetyBody:'AI analysis may be wrong and does not replace a coach or provide medical clearance. Do not use the app to diagnose concussion or injury.',
    confidence:'confidence', tapSeek:'tap to seek', visualExamples:'Visual examples', visualHint:'Simple models that turn analysis into concrete actions.',
    createProfile:'Create a local beta profile. In this version your video remains on your device.', name:'Name', email:'Email', stance:'Stance', experience:'Experience', enterBeta:'Enter beta',
    language:'Language', spanish:'Español', english:'English', chooseVideo:'Choose MP4/MOV video', chooseSport:'Sport', fighter:'Which fighter are you?', left:'Left', right:'Right',
    rounds:'Rounds (optional)', intensity:'Intensity', description:'Optional description: black shirt, red gloves…', goal:'Training objective (optional)', notes:'Optional notes', start:'Start analysis',
    processing:'Reviewing your sparring', processingNote:'CV + pose analyze the real video; Video AI can review slowed clips when configured. The report only promotes findings with enough evidence.', preparing:'Preparing video', identifying:'Identifying fighter',
    exchanges:'Reviewing exchanges', patterns:'Detecting patterns', report:'Generating report', progressTitle:'Progress', progressBody:'This beta avoids fake metrics. With more sessions, this area will show qualitative changes and measurements only when they are reliable.',
    qualitative:'Qualitative indicators prepared', lateral:'Lateral exits', postCombo:'Post-combination defense', jabVariety:'Jab variety', ringControl:'Ring control', profileTitle:'Profile',
    reset:'Delete local data', tester:'Mobile tester', iosAndroid:'Android + iOS', platformBody:'The same code is configured for Expo Go on Android and iPhone.', noSessions:'No sessions yet.',
    completed:'COMPLETED', processingStatus:'PROCESSING', selectedVideo:'Selected video', version:'Version 0.13.0 QA', aiEngine:'AI engine', aiProviderTitle:'Analysis provider', aiProviderBody:'The beta uses CV + pose on your PC and can add Video AI through the server. The architecture keeps providers interchangeable.', managedAi:'App AI', managedAiBody:'Recommended: the app manages provider choice, cost and key security. This becomes the default in the cloud beta.', byokBody:'Future BYOK requires a provider API key. A consumer ChatGPT/Claude/Gemini subscription does not necessarily include API credits.', visualCoach:'Visual coach', patternMap:'Pattern map',
    patternMapBody:'Prioritize repeated behaviors over isolated numbers.', reviewType:'Review type', sparringReview:'Full sparring', techniqueReview:'Technique review', reviewFocus:'What should be prioritized', fullReview:'Full analysis', offenseReview:'Offense', defenseReview:'Defense', footworkReview:'Footwork', combinationsReview:'Combinations', strategyReview:'Strategy', techniqueFocus:'Technique', combatEngine:'Combat Engine', combatEngineBody:'The technical knowledge base and rule engine work without depending on an LLM. Evidence comes from the real video through CV + pose and, when configured, Video AI over slowed candidate clips.', evidence:'Engine evidence', rulesMatched:'Rules matched', knowledgeBase:'Knowledge base', evidenceBeta:'Real CV/pose evidence; Video AI only when it passes evidence gates'
  }
} as const;

export function t(language:Language){return copy[language];}
