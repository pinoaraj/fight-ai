# Grapify / Fight AI — Living Product & Architecture Spec

_Last updated: 2026-08-28_

## 1. Product goal
Fight AI is a boxing/kickboxing sparring-analysis platform with mobile and web clients sharing one analysis contract. It must provide concise coach-style feedback grounded in visible video evidence, never invented strike counts or unsupported certainty.

## 2. Shared analysis contract
Every client consumes the same logical report schema:
- target fighter identity + confidence
- provider status and `usedInReport`
- summary
- strengths
- technical priorities
- opponent patterns
- tactical plan
- drills
- timestamped evidence with confidence, observation, why-it-matters and correction

Gemini may be credited only after an authenticated request succeeds and accepted evidence is present. CV/Pose and Video-AI sources must remain distinguishable.

## 3. Fighter identity
Initial target selection is explicit. Re-identification uses visible cues such as glove/shirt color, relative height/build, stance and temporal continuity. LOW-confidence windows are excluded from evidence.

## 4. Mobile baseline
Current mobile beta work includes Android Expo, PDF report export/share, provider attribution gate, visual coaching demos, ES/EN language consistency and Android automated QA with real APK + virtual navigation agent.

Release gate: do not call the mobile beta release-ready until source validation, demos, APK build, Android navigation and authenticated Gemini proof all pass together.

## 5. Web MVP
Branch: `web/mvp`
PR: #2
Stack: Next.js 15.5.24 + React 19 + TypeScript.

Current MVP scope:
- local video upload and playback
- target fighter selection
- boxing/kickboxing + stance selection
- clickable report timestamps
- strengths / priorities / opponent / tactical plan / drills
- explicit provider + `usedInReport` state
- demo mode clearly marked as non-AI
- shared-backend adapter aligned with the mobile engine
- authenticated server-side Gemini video-analysis fallback when the shared backend is not configured
- CI with TypeScript, Next.js production build, shared-backend adapter/runtime smoke QA and Docker production build
- `/api/health` exposing `backendConfigured`, `geminiConfigured` and `analysisReady`

The CI runtime smoke boots the built Next.js server against a local mock Fight AI backend, validates `/api/health`, sends the multipart analysis contract through `/api/analyze`, and verifies provider attribution, summary, timestamp evidence and drill normalization before the Docker gate.

Latest Web MVP CI on commit `ba6682f2` is green for TypeScript, Next.js production build, shared-backend adapter/runtime smoke QA and Docker build. PR #2 remains open, draft and mergeable.

Next.js was moved from 15.5.2 to maintenance-security release 15.5.24 before public deployment.

## 6. Shared backend and Gemini contract
Preferred production path remains the shared Fight AI analysis backend via `FIGHT_AI_API_URL` and optional `FIGHT_AI_WEB_TOKEN`.

If the shared backend is absent, the web server may use authenticated Gemini directly as a temporary analysis fallback. The browser never receives the Gemini key. The server uploads the selected video to Gemini Files API, waits for ACTIVE state, requests structured Spanish coaching JSON, and marks `provider: Gemini` + `usedInReport: true` only after a successful authenticated response and valid JSON parse.

The fallback prompt forbids invented exact punch counts and asks for visible evidence, tactical hypotheses, at most three main priorities, actionable drills and timestamps only when supported.

## 7. Web input contract
Multipart fields aligned with mobile include:
- `video`
- `language`
- `sport`
- `athlete_marker`
- `glove_color` when known
- `stance`

Additional re-identification fields can be added without changing the analysis contract: `top_color`, `relative_height`, `build`, and fighter anchor coordinates.

## 8. Visual coaching
Detected mistakes should link to correction visuals. Product direction supports short motion demos, angle/trajectory graphics and simplified animated teaching examples. Visuals must correspond to the detected issue rather than generic boxing clips.

## 9. QA matrix
Before release, validate together:
- video upload/playback
- timestamp seeking
- fighter identity persistence
- analysis rendering
- asynchronous backend polling and legacy fallback
- shared-backend multipart adapter/runtime smoke
- authenticated Gemini fallback
- ES/EN consistency
- provider labels + `usedInReport`
- CV/Pose/Video-AI source labels
- drills and visual examples
- PDF/export path
- Android real-app navigation
- web TypeScript + production build
- web Docker build
- public `/api/health`
- deployed `/api/analyze` authenticated Gemini smoke with `provider: Gemini` and `usedInReport: true`
- real sparring upload/report E2E

Regression footage should stay outside normal public Git history whenever practical.

## 10. AWS production architecture
App Runner is not used: AWS stopped onboarding new App Runner customers on 2026-03-31, and this account receives `SubscriptionRequiredException` for App Runner.

Current web production architecture:
- container registry: private Amazon ECR `fight-ai-web`
- runtime: Amazon ECS on AWS Fargate
- ingress: internet-facing Application Load Balancer
- container port: 3000
- ALB listener: HTTP 80 for beta/test URL
- health target: `/api/health`
- GitHub Actions authentication: GitHub OIDC with immutable owner/repository subject IDs
- deployment role: `FightAIGitHubDeployRole`
- ECS task execution role: `FightAIEcsTaskExecutionRole`
- cluster/service/task family: `fight-ai-web`
- one Fargate task for beta

The workflow creates/reuses the default VPC public subnets, separate ALB/task security groups, ALB target group, listener, ECS cluster/service and immutable ECR image tag by Git commit.

AWS compute is activated and the deployment now succeeds through GitHub OIDC, ECR image push, ALB creation, ECS Fargate service deployment and public health verification in `sa-east-1`.

Current public beta endpoint: `http://fight-ai-web-alb-2053895073.sa-east-1.elb.amazonaws.com`.

Verified health response reports `ok: true`, `service: fight-ai-web`, `geminiConfigured: true`, `analysisReady: true`, and `providerAttributionPolicy: usedInReport-required`.

The deployment workflow now also generates a tiny synthetic MP4 and posts it through the deployed `/api/analyze` endpoint. The gate passes only if a real authenticated Gemini response returns `provider: Gemini`, `usedInReport: true`, and a non-empty summary. This closes the distinction between “Gemini configured” and “Gemini actually participated”.

### Gemini runtime secret status
AWS Secrets Manager and SSM Parameter Store both currently return `SubscriptionRequiredException` for this account. For the beta deployment only, the GitHub Actions `GEMINI_API_KEY` secret is injected as a server-side ECS task environment variable. It is never committed to Git and is never sent to browser JavaScript. Migrate it to Secrets Manager/SSM when those services become available for the account.

### Next production hardening
- add HTTPS with ACM certificate + port 443 before general public launch
- move Gemini key to AWS managed secret storage
- move uploaded video storage to private S3 with short-lived URLs and retention/deletion policy
- add CloudWatch logs/metrics
- deploy the shared CV/Pose backend and set `FIGHT_AI_API_URL`

## 11. Security / privacy
- no Gemini key in client code or source control
- no static AWS access keys in repository
- GitHub Actions uses short-lived OIDC credentials
- uploaded sparring video private by default
- temporary/presigned access in production
- minimize video retention
- provider attribution must be truthful
- no invented statistics or certainty

## 12. Current workstreams
1. `qa/cloud-android`: close authenticated Gemini + Android virtual-agent release gates.
2. `web/mvp`: keep CI + runtime adapter QA green, keep ECS/ALB deployment healthy, and complete the deployed Gemini smoke plus a real sparring upload/report E2E.
3. Deploy/connect the shared CV/Pose analysis backend so mobile and web use the same full engine rather than relying on the web Gemini fallback.
4. Keep both clients aligned to this Grapify spec and the same report contract.
