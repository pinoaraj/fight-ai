export type Language = 'es' | 'en';
export type Sport = 'boxing' | 'kickboxing';
export type Stance = 'ORTHODOX' | 'SOUTHPAW' | 'SWITCH';
export type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'AMATEUR_COMPETITOR' | 'PROFESSIONAL';
export type Intensity = 'TECHNICAL' | 'LIGHT' | 'MODERATE' | 'HARD';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type EventCategory = 'GOOD' | 'ISSUE' | 'OFFENSE' | 'DEFENSE' | 'FOOTWORK' | 'STRATEGY';
export type TechniqueVideoKey = 'jabCrossPivot' | 'slipCounter' | 'lateralExit' | 'guardRecovery' | 'kickCheck' | 'jabFeintBody';
export type AiProviderId = 'managed' | 'openai' | 'anthropic' | 'gemini' | 'compatible';
export type ReviewMode = 'SPARRING' | 'TECHNIQUE';
export type ReviewFocus = 'FULL' | 'OFFENSE' | 'DEFENSE' | 'FOOTWORK' | 'COMBINATIONS' | 'STRATEGY' | 'TECHNIQUE';
export type EvidenceSource = 'SIMULATED_BETA' | 'COMPUTER_VISION' | 'VIDEO_AI' | 'MULTIMODAL' | 'USER_CONTEXT';

export type FighterVisualProfile = {gloveColor?:string; topColor?:string; relativeHeight?:string; build?:string; stance?:Stance};
export type FighterAnchor = {x:number;y:number};

export type Profile = {name:string; email:string; stance:Stance; experience:Experience; language:Language; preferredAiProvider?:AiProviderId};
export type TimelineEvent = {timestamp:number; category:EventCategory; title:string; description:string; confidence:Confidence};
export type Observation = {title:string; description:string; whyItMatters:string; recommendation?:string; timestamps:number[]; confidence:Confidence; ruleId?:string};
export type Drill = {name:string; goal:string; instructions:string[]; duration:string; difficulty:string};
export type VisualExample = {id:string;title:string;category:'ATTACK'|'DEFENSE'|'FOOTWORK'|'IMPROVEMENT';cue:string;steps:readonly string[];note:string;videoKey:TechniqueVideoKey;};
export type EvidenceFact = {id:string;key:string;value:number;confidence:Confidence;timestamps:number[];source:EvidenceSource;note?:string;};
export type EngineMetadata = {engineVersion:string;knowledgeVersion:string;evidenceMode:EvidenceSource;evidenceCount:number;matchedRules:string[];reviewMode:ReviewMode;reviewFocus:ReviewFocus;};
export type ClinicalPattern = {key:string; title:string; description:string; tacticalConsequence:string; correction:string; timestamps:number[]; confidence:Confidence; occurrences:number; valence:'STRENGTH'|'PRIORITY'|'WATCH'};
export type ClinicalCoach = {patterns:ClinicalPattern[]; dominantSignatures:{signature:string;count:number}[]; coverageConfidence:Confidence; limitations:string[]};

export type Analysis = {
  analysisFingerprint:string;
  mainTakeaway:string;
  strengths:Observation[];
  weaknesses:Observation[];
  nextSessionGoals:string[];
  strategy:{summary:string; rematchStrategy:string; opponentAnalysis?:{observedOpponentPatterns:{title:string;description:string;timestamps:number[];confidence:Confidence}[];tacticalHypotheses:string[];rematchPlan:string[];evidenceBoundary:string}};
  drills:Drill[];
  timelineEvents:TimelineEvent[];
  visualExamples:VisualExample[];
  evidence?:EvidenceFact[];
  engine?:EngineMetadata;
  clinicalCoach?:ClinicalCoach;
  realVision?:{athleteMarker:string;redGloveCoverage:number;opponentBlueCoverage:number;identityMode?:string;identityUsableFraction?:number;lowConfidencePolicy?:string;measurements:Record<string,number>;limitations:string[];videoAI?:{available:boolean;provider?:string;model?:string;clipsAnalyzed?:number;clipsRequested?:number;failedClips?:number;acceptedObservations?:number;usedInReport?:boolean;reason?:string;languageRejectedCount?:number;observations?:{subject:'ATHLETE'|'OPPONENT'|'INTERACTION';assessment?:'STRENGTH'|'ISSUE'|'NEUTRAL';domain:string;observedFact:string;tacticalConsequence:string;correctionOrExploit:string;confidence:Confidence;timestamp:number;clipId?:string}[]};pose?:{available:boolean;provider?:string;poseUsableFraction?:number;measurements:Record<string,number|null>;limitations:string[]}};
};

export type Session = {
  id:string;
  createdAt:string;
  sport:Sport;
  videoUri:string;
  fileName:string;
  fileSize?:number;
  rounds?:number;
  intensity:Intensity;
  fighterPosition:'LEFT'|'RIGHT';
  fighterDescription?:string;
  fighterAnchor?:FighterAnchor;
  fighterVisualProfile?:FighterVisualProfile;
  trainingGoal?:string;
  notes?:string;
  reviewMode?:ReviewMode;
  reviewFocus?:ReviewFocus;
  status:'PROCESSING'|'COMPLETED'|'FAILED';
  analysis?:Analysis;
};
