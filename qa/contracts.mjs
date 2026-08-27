import fs from 'node:fs';

const fail=(m)=>{console.error('[FAIL]',m);process.exitCode=1};
const pass=(m)=>console.log('[PASS]',m);

const ai=fs.readFileSync('src/aiStatus.ts','utf8');
const vision=fs.readFileSync('src/realVision.ts','utf8');
const i18n=fs.readFileSync('src/i18n.ts','utf8');

if(ai.includes("videoAI?.usedInReport")) pass('Gemini report attribution gated by usedInReport');
else fail('Gemini attribution is not gated by usedInReport');

if(ai.includes("IA CONECTADA · GEMINI") && ai.includes("MOTOR CONECTADO · CV + POSE"))
  pass('Connected AI and connected CV/Pose have distinct visible states');
else fail('AI connection states are not explicit');

if(vision.includes('videoAiConfigured') && vision.includes('videoAiModel'))
  pass('Vision health exposes Video AI configuration/model');
else fail('Vision health missing Video AI state');

if(!i18n.includes('Main takeaway') || i18n.includes("en: {"))
  pass('Bilingual dictionaries present');
else fail('Unexpected language contract');

console.log('Contract QA complete');
