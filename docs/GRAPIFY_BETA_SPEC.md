# Grapify / Fight AI — Living Product & Architecture Spec

_Last updated: 2026-08-28_

## 1. Product goal
Fight AI is a boxing/kickboxing sparring-analysis platform with mobile and web clients sharing one analysis engine. It must provide concise coach-style feedback grounded in video evidence, not invented strike counts or unsupported certainty.

## 2. Shared analysis contract
Every client must consume the same logical report schema:
- target fighter identity + confidence
- provider status and `usedInReport`
- summary
- strengths
- technical priorities
- opponent patterns
- tactical plan
- drills
- timestamped evidence with confidence, observation, why-it-matters and correction

Gemini may be credited only after an authenticated request succeeds and accepted evidence is present. CV/Pose and Video-AI sources must be labeled separately.

## 3. Fighter identity
Initial target selection is explicit. Re-identification uses visible cues such as glove/shirt color, relative height/build, stance and temporal continuity. LOW-confidence windows are excluded from evidence.

## 4. Mobile baseline
Current mobile beta work includes:
- Android Expo app
- PDF report export/share
- provider attribution gate
- visual coaching demos
- ES/EN language consistency
- Android automated QA with real APK + virtual navigation agent

Release gate: do not call the mobile beta release-ready until source validation, demos, APK build, Android navigation and authenticated Gemini proof all pass.

## 5. Web MVP
Branch: `web/mvp`
PR: #2
Stack: Next.js 15 + React 19 + TypeScript.

Current MVP scope:
- local video upload and playback
- target fighter selection
- clickable report timestamps
- strengths / priorities / opponent / tactical plan / drills
- explicit provider + `usedInReport` state
- demo mode clearly marked as non-AI
- `/api/analyze` proxy ready to reuse the shared Fight AI backend
- separate CI with TypeScript and production build

The web client must not duplicate analysis logic. It should send video + target identity to the backend and render the normalized report contract.

## 6. Backend boundary
Web environment variable: `FIGHT_AI_API_URL`.
Optional server-to-server token: `FIGHT_AI_WEB_TOKEN`.
Gemini keys stay server-side only; never expose them in browser JavaScript or mobile bundles.

Expected endpoint:
`POST /analyze`
Multipart form containing the sparring video and target fighter descriptor. The backend returns the normalized report JSON.

## 7. Visual coaching
Detected mistakes should link to correction visuals. Current product direction supports short motion demos, angle/trajectory graphics and simplified animated teaching examples. Visuals must correspond to the detected issue rather than generic boxing clips.

## 8. QA matrix
Before release, validate together:
- video upload/playback
- timestamp seeking
- fighter identity persistence
- analysis rendering
- ES/EN language consistency
- provider labels and `usedInReport`
- CV/Pose/Video-AI source labels
- drills and visual examples
- PDF/export path
- Android real-app navigation
- web TypeScript + production build
- authenticated Gemini regression on real sparring footage

Regression footage should remain outside normal Git history whenever practical. Public repositories must not become a permanent store for private sparring videos.

## 9. Web deployment strategy
### Preview
A temporary preview can be deployed independently of AWS after CI is green. The preview must clearly mark demo/non-connected backend states.

### AWS production
Preferred authentication is GitHub Actions OIDC to an AWS IAM role. Do **not** paste AWS access keys into chat and do not commit long-lived credentials.

Recommended target architecture:
- frontend: AWS Amplify Hosting or CloudFront-backed Next.js deployment
- analysis API: existing Fight AI backend endpoint
- uploaded videos: private S3 bucket with short-lived presigned URLs
- secrets: AWS Secrets Manager / CI secret store
- logs/metrics: CloudWatch
- retention: explicit deletion policy for uploaded sparring footage

Required deployment values when production is enabled:
- AWS account/role setup for GitHub OIDC
- AWS region
- deployment target (Amplify or equivalent)
- backend public/private URL
- optional domain name

## 10. Security / privacy
- no Gemini key in client code
- no AWS static access keys in repository
- uploaded sparring video private by default
- use temporary/presigned video access
- minimize retention
- provider attribution must be truthful
- no invented statistics or certainty

## 11. Current workstreams
1. `qa/cloud-android`: close authenticated Gemini + Android virtual-agent release gates.
2. `web/mvp`: get CI green, connect shared backend, produce a testable preview URL, then prepare AWS deployment.
3. Keep both clients aligned to this Grapify spec and the same analysis contract.
