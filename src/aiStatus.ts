import type {Language} from './types';
import type {VisionHealth} from './realVision';

export type AiConnectionState = 'OFFLINE'|'CONNECTED'|'CONNECTED_GEMINI';

export function aiConnectionState(health?:VisionHealth|null):AiConnectionState{
  if(!health?.ok) return 'OFFLINE';
  return health.videoAiConfigured ? 'CONNECTED_GEMINI' : 'CONNECTED';
}

export function aiConnectionLabel(language:Language, health?:VisionHealth|null):string{
  const state=aiConnectionState(health);
  if(language==='es'){
    if(state==='CONNECTED_GEMINI') return `IA CONECTADA · GEMINI ${health?.videoAiModel??''}`.trim();
    if(state==='CONNECTED') return 'MOTOR CONECTADO · CV + POSE';
    return 'MOTOR SIN CONEXIÓN';
  }
  if(state==='CONNECTED_GEMINI') return `AI CONNECTED · GEMINI ${health?.videoAiModel??''}`.trim();
  if(state==='CONNECTED') return 'ENGINE CONNECTED · CV + POSE';
  return 'ENGINE OFFLINE';
}

export function reportSourceLabel(
  language:Language,
  videoAI?:{usedInReport?:boolean;clipsAnalyzed?:number;provider?:string;model?:string}
):string{
  const used=Boolean(videoAI?.usedInReport);
  if(language==='es'){
    return used
      ? `FUENTES · CV + POSE + GEMINI · ${videoAI?.clipsAnalyzed??0} CLIPS`
      : 'FUENTES · CV + POSE';
  }
  return used
    ? `SOURCES · CV + POSE + GEMINI · ${videoAI?.clipsAnalyzed??0} CLIPS`
    : 'SOURCES · CV + POSE';
}
