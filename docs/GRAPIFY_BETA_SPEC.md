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
- boxing/kickboxing + stance selection
- clickable report timestamps
- strengths / priorities / opponent / tactical plan / drills
- explicit provider + `usedInReport` state
- demo mode clearly marked as non-AI
- shared-backend adapter aligned with the mobile engine
- separate CI with TypeScript, production build and Docker build
- production Docker image for cloud deployment
- `/api/health` runtime endpoint for preview/cloud checks

Current web QA state:
- TypeScript: previously PASS; rerunning after shared-backend integration
- Next.js production build: previously PASS; rerunning after shared-backend integration
- Docker image build: active CI release gate

The web client must not duplicate analysis logic. It sends video + target identity to the same backend used by mobile and normalizes the shared `Analysis` object only for presentation.

## 6. Shared backend contract
Web server configuration:
- `FIGHT_AI_API_URL`
- optional `FIGHT_AI_WEB_TOKEN`

Gemini keys stay server-side only; never expose them in browser JavaScript or mobile bundles.

Backend discovery/flow mirrors the mobile client:
1. `GET /health`
2. if `asyncJobs=true`: `POST /jobs/analyze`, then poll `GET /jobs/{jobId}` until `COMPLETED` or `FAILED`
3. otherwise fallback to legacy `POST /analyze`

Multipart fields currently aligned with mobile include:
- `video`
- `language`
- `sport`
- `athlete_marker`
- `glove_color` when known
- `stance`

Additional visual re-identification fields supported by the mobile contract can be added to the web selector without changing the backend: `top_color`, `relative_height`, `build`, and fighter anchor coordinates.

The web adapter reads the backend `Analysis` structure (`mainTakeaway`, strengths, weaknesses, opponent analysis, rematch plan, drills and timestamps) and renders it into the web report. `realVision.videoAI.usedInReport` is the only accepted signal for displaying a Video-AI provider as having participated in the report.

## 7. Visual coaching
Detected mistakes should link to correction visuals. Current product direction supports short motion demos, angle/trajectory graphics and simplified animated teaching examples. Visuals must correspond to the detected issue rather than generic boxing clips.

## 8. QA matrix
Before release, validate together:
- video upload/playback
- timestamp seeking
- fighter identity persistence
- analysis rendering
- asynchronous job polling and legacy fallback
- ES/EN language consistency
- provider labels and `usedInReport`
- CV/Pose/Video-AI source labels
- drills and visual examples
- PDF/export path
- Android real-app navigation
- web TypeScript + production build
- web production Docker build
- web `/api/health`
- authenticated Gemini regression on real sparring footage

Regression footage should remain outside normal Git history whenever practical. Public repositories must not become a permanent store for private sparring videos.

## 9. Web deployment strategy
### Test/preview
The web is considered preview-ready after TypeScript + production build + Docker build are green. A preview must clearly show when the shared backend is disconnected and must never label demo data as AI output.

### AWS target
Preferred target: private Amazon ECR image + AWS App Runner service. GitHub Actions authenticates through AWS/GitHub OIDC rather than permanent AWS access keys.

Prepared repository assets:
- `Dockerfile`
- `.dockerignore`
- `infra/aws/web-aws-deploy.template.yml` (inactive deployment template)

The deployment template remains inactive until the AWS account authorizes the repository and the required repository variables are configured. It must first be tested as a manual deployment before any automatic production deploy is enabled.

Required non-secret GitHub repository variables:
- `AWS_REGION`
- `AWS_ROLE_ARN`
- `AWS_ECR_REPOSITORY`
- `AWS_APP_RUNNER_SERVICE_ARN`

Runtime server configuration:
- `FIGHT_AI_API_URL`
- optional `FIGHT_AI_WEB_TOKEN`

No Gmail password, AWS password, static AWS access key or Gemini key belongs in source control or browser code.

## 10. AWS production architecture
- web runtime: AWS App Runner, port 3000
- image registry: private Amazon ECR
- health check target: `/api/health`
- analysis API: shared Fight AI backend
- future production video storage: private S3 + short-lived access + explicit retention/deletion policy
- secrets: server-side only
- logs/metrics: cloud runtime observability

Production is not considered live until the public/test URL returns the real web build and backend/provider behavior is validated end-to-end.

## 11. Security / privacy
- no Gemini key in client code
- no AWS static access keys in repository
- no personal passwords used for deployment
- uploaded sparring video private by default
- use temporary/presigned video access in production
- minimize retention
- provider attribution must be truthful
- no invented statistics or certainty

## 12. Current workstreams
1. `qa/cloud-android`: close authenticated Gemini + Android virtual-agent release gates.
2. `web/mvp`: complete shared-backend CI, validate Docker image, obtain an authorized AWS preview environment, then run real upload/report E2E.
3. Keep both clients aligned to this Grapify spec and the same analysis contract.
