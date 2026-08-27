import type {Analysis, Language, Session} from './types';

const API_URL=(process.env.EXPO_PUBLIC_VISION_API_URL??'').replace(/\/$/,'');

export type VisionHealth={ok:boolean; version?:string; poseModelReady?:boolean; videoAiConfigured?:boolean; videoAiModel?:string; asyncJobs?:boolean; queuedJobs?:number;};

export function realVisionConfigured(){return Boolean(API_URL)}
export function realVisionApiUrl(){return API_URL}

const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchWithTimeout(url:string, init:RequestInit={}, timeoutMs=6000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}
}

export async function getVisionHealth(language:Language):Promise<VisionHealth>{
  if(!API_URL) throw new Error(language==='es'?'Real Vision no tiene URL configurada. Ejecuta INICIAR_FIGHT_AI_REAL.cmd.':'Real Vision has no configured URL. Run INICIAR_FIGHT_AI_REAL.cmd.');
  try{
    const res=await fetchWithTimeout(`${API_URL}/health`,{},6000);
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    return await res.json() as VisionHealth;
  }catch(e){
    const detail=e instanceof Error?e.message:String(e);
    throw new Error(language==='es'
      ?`No hay conexión con el motor de análisis (${API_URL}). La app no iniciará el análisis hasta recuperar la conexión. Detalle: ${detail}`
      :`No connection to the analysis engine (${API_URL}). The app will not start analysis until connectivity recovers. Detail: ${detail}`);
  }
}

function buildForm(session:Session,language:Language){
  const form=new FormData();
  form.append('video',{uri:session.videoUri,name:session.fileName,type:session.fileName.toLowerCase().endsWith('.mov')?'video/quicktime':'video/mp4'} as unknown as Blob);
  form.append('language',language);form.append('sport',session.sport);
  form.append('athlete_marker',session.fighterVisualProfile?.gloveColor==='red'?'red_gloves':'visual_reid');
  if(session.fighterAnchor){form.append('fighter_anchor_x',String(session.fighterAnchor.x));form.append('fighter_anchor_y',String(session.fighterAnchor.y));}
  if(session.fighterVisualProfile?.gloveColor)form.append('glove_color',session.fighterVisualProfile.gloveColor);
  if(session.fighterVisualProfile?.topColor)form.append('top_color',session.fighterVisualProfile.topColor);
  if(session.fighterVisualProfile?.relativeHeight)form.append('relative_height',session.fighterVisualProfile.relativeHeight);
  if(session.fighterVisualProfile?.build)form.append('build',session.fighterVisualProfile.build);
  if(session.fighterVisualProfile?.stance)form.append('stance',session.fighterVisualProfile.stance.toLowerCase());
  return form;
}

async function createJob(session:Session,language:Language){
  const form=buildForm(session,language);
  try{
    const res=await fetch(`${API_URL}/jobs/analyze`,{method:'POST',body:form});
    const text=await res.text();
    if(res.status===404)return null;
    if(!res.ok)throw new Error(text||`HTTP ${res.status}`);
    return JSON.parse(text) as {jobId:string;status:string;progress:number};
  }catch(e){
    const detail=e instanceof Error?e.message:String(e);
    throw new Error(language==='es'
      ?`No pude subir el video al PC. El análisis no comenzó. URL: ${API_URL}. Detalle: ${detail}`
      :`Could not upload the video to the PC. Analysis did not start. URL: ${API_URL}. Detail: ${detail}`);
  }
}

async function pollJob(jobId:string,language:Language):Promise<Analysis>{
  const deadline=Date.now()+25*60*1000;
  let networkMisses=0;
  while(Date.now()<deadline){
    try{
      const res=await fetchWithTimeout(`${API_URL}/jobs/${jobId}`,{},7000);
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const job=await res.json() as {status:string;progress?:number;error?:string;result?:{report?:Analysis}};
      networkMisses=0;
      if(job.status==='COMPLETED'){
        if(!job.result?.report)throw new Error(language==='es'?'El job terminó sin reporte.':'The job finished without a report.');
        return job.result.report;
      }
      if(job.status==='FAILED')throw new Error(job.error||(language==='es'?'El motor detuvo el análisis.':'The engine stopped the analysis.'));
    }catch(e){
      networkMisses++;
      if(networkMisses>=8){
        const detail=e instanceof Error?e.message:String(e);
        throw new Error(language==='es'
          ?`El análisis sigue/seguía en el PC, pero el teléfono perdió la conexión varias veces. Vuelve a la misma Wi‑Fi y reintenta. Job: ${jobId}. Detalle: ${detail}`
          :`The analysis is/was still running on the PC, but the phone lost connectivity repeatedly. Rejoin the same Wi-Fi and retry. Job: ${jobId}. Detail: ${detail}`);
      }
    }
    await wait(2200);
  }
  throw new Error(language==='es'?'El análisis superó el tiempo máximo de espera (25 min).':'Analysis exceeded the 25-minute wait limit.');
}

async function legacyAnalyze(session:Session,language:Language):Promise<Analysis>{
  const form=buildForm(session,language);
  const res=await fetch(`${API_URL}/analyze`,{method:'POST',body:form});
  const text=await res.text();
  if(!res.ok)throw new Error(text||`Vision API error ${res.status}`);
  const payload=JSON.parse(text) as {report:Analysis};
  if(!payload.report)throw new Error(language==='es'?'Vision API no devolvió reporte.':'Vision API returned no report.');
  return payload.report;
}

export async function analyzeWithRealVision(session:Session,language:Language):Promise<Analysis>{
  const health=await getVisionHealth(language);
  const job=health.asyncJobs?await createJob(session,language):null;
  if(job?.jobId)return pollJob(job.jobId,language);
  return legacyAnalyze(session,language);
}
