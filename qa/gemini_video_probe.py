import json, os, time, urllib.request, urllib.parse, urllib.error

KEY=os.environ.get('GEMINI_API_KEY','').strip()
VIDEO=os.environ.get('FIGHT_AI_VIDEO','').strip()
REQUESTED_MODEL=os.environ.get('GEMINI_MODEL','gemini-2.5-flash').strip()
if not KEY: raise SystemExit('GEMINI_API_KEY missing')
if not VIDEO or not os.path.isfile(VIDEO): raise SystemExit('FIGHT_AI_VIDEO missing')
base='https://generativelanguage.googleapis.com'

def req(url, data=None, method=None, headers=None, retries=5):
    r=urllib.request.Request(url,data=data,method=method,headers=headers or {})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(r,timeout=180) as x: return x.read().decode()
        except urllib.error.HTTPError as e:
            if e.code not in (429,500,502,503,504) or attempt == retries-1:
                raise
            time.sleep(min(2 ** attempt, 12))
        except urllib.error.URLError:
            if attempt == retries-1: raise
            time.sleep(min(2 ** attempt, 12))
    raise RuntimeError('request retry loop exhausted')

def available_generate_models():
    payload=json.loads(req(base+'/v1beta/models?key='+urllib.parse.quote(KEY),retries=4))
    out=[]
    for model in payload.get('models',[]):
        methods=model.get('supportedGenerationMethods') or []
        name=(model.get('name') or '').removeprefix('models/')
        if name and 'generateContent' in methods and name.startswith('gemini-'):
            out.append(name)
    return out

def choose_model():
    available=available_generate_models()
    preferred=[REQUESTED_MODEL,'gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.1-flash-lite','gemini-2.5-flash']
    for candidate in preferred:
        if candidate in available:
            if candidate != REQUESTED_MODEL:
                print('[INFO] requested Gemini model unavailable; using authenticated compatible model',candidate)
            return candidate
    flash=[m for m in available if 'flash' in m and 'image' not in m and 'tts' not in m and 'audio' not in m]
    if flash:
        chosen=sorted(flash,reverse=True)[0]
        print('[INFO] using authenticated available Gemini Flash model',chosen)
        return chosen
    raise SystemExit('No authenticated Gemini generateContent model is available for this API key')

MODEL=choose_model()

size=os.path.getsize(VIDEO)
start=urllib.request.Request(base+'/upload/v1beta/files',method='POST',headers={
 'x-goog-api-key':KEY,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start',
 'X-Goog-Upload-Header-Content-Length':str(size),'X-Goog-Upload-Header-Content-Type':'video/mp4',
 'Content-Type':'application/json'})
start.data=json.dumps({'file':{'display_name':os.path.basename(VIDEO)}}).encode()
with urllib.request.urlopen(start,timeout=60) as r: upload=r.headers['X-Goog-Upload-URL']
with open(VIDEO,'rb') as fh: raw=fh.read()
meta=json.loads(req(upload,raw,'POST',{'Content-Length':str(size),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'}))
f=meta['file']; name=f['name']
for _ in range(60):
    try:
        state=json.loads(req(base+'/v1beta/'+name+'?key='+urllib.parse.quote(KEY),retries=4))['state']
    except urllib.error.HTTPError as e:
        if e.code in (429,500,502,503,504):
            time.sleep(5); continue
        raise
    if state=='ACTIVE': break
    if state=='FAILED': raise SystemExit('Gemini file processing failed')
    time.sleep(5)
else: raise SystemExit('Gemini file processing timeout')

prompt='''Analyze this boxing sparring video as a technical combat-sports coach. Focus ONLY on the fighter wearing RED GLOVES. Do not confuse him with the opponent. Return JSON only, in Spanish. Do not invent punch counts or landed strikes that are not clearly visible. Include: fighter_identity_confidence; summary; strengths; weaknesses; opponent_patterns; tactical_plan; drills; and evidence. evidence must be an array of objects with timestamp_seconds, confidence (LOW/MEDIUM/HIGH), observation, why_it_matters, correction. Prefer a small number of high-value repeated patterns. Explicitly distinguish visible facts from tactical hypotheses.'''
payload={'contents':[{'parts':[{'file_data':{'mime_type':'video/mp4','file_uri':f['uri']}},{'text':prompt}]}],
 'generationConfig':{'responseMimeType':'application/json','temperature':0.2}}
out=json.loads(req(base+'/v1beta/models/'+urllib.parse.quote(MODEL,safe='')+':generateContent?key='+urllib.parse.quote(KEY),json.dumps(payload).encode(),'POST',{'Content-Type':'application/json'},retries=5))
text=out['candidates'][0]['content']['parts'][0]['text']
parsed=json.loads(text)
result={'provider':'Gemini','model':MODEL,'usedInReport':True,'target':'red gloves','video':os.path.basename(VIDEO),'analysis':parsed}
os.makedirs('qa-artifacts',exist_ok=True)
with open('qa-artifacts/gemini-red-gloves-analysis.json','w',encoding='utf-8') as h: json.dump(result,h,ensure_ascii=False,indent=2)
print('[PASS] authenticated Gemini video analysis completed; usedInReport=true')
