# Grapify / Fight AI — Living Product & Architecture Spec

_Last updated: 2026-08-29_

## 1. Product goal
Fight AI is a boxing/kickboxing sparring-analysis platform with mobile and web clients sharing one analysis contract. It must provide concise coach-style feedback grounded in visible video evidence, never invented strike counts or unsupported certainty.

### Core coaching premise — clinical eye, not generic commentary
Fight AI must analyze sparring as closely as possible to how an experienced combat-sports coach reviews a round. The engine should not merely label isolated mistakes; it should connect visible actions into recurring technical and tactical patterns, explain why those patterns matter in the matchup, identify what the opponent is exploiting or vulnerable to, and convert the highest-value findings into specific corrections, game-plan adjustments and drills.

The expected reasoning pattern for every report is:
- observe what actually happened on video;
- distinguish one-off moments from recurring patterns;
- infer the technical/tactical cause only when evidence supports it;
- prioritize the 2–3 issues that would most change performance rather than flooding the athlete with minor notes;
- identify strengths that can be deliberately built into the game plan;
- analyze opponent habits, preferred range, reactions and exploitable tendencies;
- explain what to do differently, when to do it and why;
- attach timestamp evidence and correction guidance;
- turn corrections into drills and visual teaching aids tied to the detected mistake;
- clearly label tactical hypotheses when certainty is lower.

A Fight AI report should feel like a real post-sparring coach review: concise, specific, contextual and actionable. Generic advice such as “keep your hands up” or “move your feet more” is insufficient unless the report explains the exact recurring context, consequence and correction visible in the footage.

## 2. Shared analysis contract
Every client consumes the same logical report schema:
- target fighter identity + confidence
- provider status and `usedInReport`
- summary / main takeaway
- strengths
- technical priorities
- opponent patterns
- tactical/rematch plan
- next-session goals
- drills
- timestamped evidence with confidence, observation, why-it-matters and correction

Gemini may be credited only after an authenticated request succeeds and accepted evidence is present. CV/Pose and Video-AI sources must remain distinguishable.

## 3. Fighter identity
Initial target selection is explicit. Re-identification uses visible cues such as glove/shirt color, relative height/build, stance and temporal continuity. LOW-confidence windows are excluded from evidence.

## 4. Mobile baseline
Current mobile beta work includes Android Expo, PDF report export/share, provider attribution gate, visual coaching demos, ES/EN language consistency and Android automated QA with real APK + virtual navigation agent.

Release gate: do not call the mobile beta release-ready until source validation, demos, APK build, Android navigation and authenticated Gemini proof all pass together.

## 5. Web product parity — Android is the source of truth
Branch: `web/mvp`
PR: #2
Stack: Next.js 15.5.24 + React 19 + TypeScript.

The web client is not a reduced or alternate Fight AI product. It must be a responsive browser mirror of the Android app. Android interaction flow, available analysis choices, report hierarchy, provider status, evidence, drills/visual coaching and export behavior are the product source of truth. Web-specific differences are allowed only when required by browser/platform constraints.

Required web parity flow:
1. Home/analyze entry equivalent to Android.
2. Choose/upload sparring video and preview/play it before analysis.
3. Select the target fighter after video selection using the same practical identity options as Android, including visual fighter selection/re-identification rather than relying only on a fixed glove-color button.
4. Select discipline, stance/guard and the same analysis inputs/options exposed by Android.
5. Show a dedicated processing state comparable to the Android processing screen; long analysis must not look like a frozen request.
6. Render the same coaching report structure and semantic priorities used by Android: main takeaway, strengths, weaknesses/priorities, opponent analysis, tactical/rematch plan, next-session goals, drills, evidence and correction guidance.
7. Timestamp evidence must seek/play the uploaded video at the corresponding moment.
8. Provider status must explicitly show whether Gemini/Video AI/CV/Pose was connected and whether it actually participated in the current report; `usedInReport=true` remains mandatory before crediting a provider.
9. Evidence/source details must be expandable/toggleable similar to Android.
10. Visual Coach examples/demos linked to detected mistakes must be available from the report where Android exposes them.
11. Export/share a PDF coaching report from the web with the same information hierarchy as Android.
12. Preserve ES/EN behavior: one selected language only, with no duplicated mixed-language analysis.
13. Sessions/history/progress/profile surfaces should follow Android as those mobile features stabilize; web should not invent a conflicting navigation model.

Current implemented web pieces already include local video upload/playback, basic target selection, boxing/kickboxing + stance, clickable timestamps, strengths/priorities/opponent/tactical plan/drills, explicit provider + `usedInReport`, server-side Gemini fallback, CI and `/api/health`. These are an interim subset and must be expanded/reworked to Android parity before the web beta is considered feature-complete.

The CI runtime smoke boots the built Next.js server against a local mock Fight AI backend, validates `/api/health`, sends the multipart analysis contract through `/api/analyze`, and verifies provider attribution, summary, timestamp evidence and drill normalization before the Docker gate.

Next.js was moved from 15.5.2 to maintenance-security release 15.5.24 before public deployment.

## 6. Shared backend and Gemini contract
Preferred production path remains the shared Fight AI analysis backend via `FIGHT_AI_API_URL` and optional `FIGHT_AI_WEB_TOKEN`.

If the shared backend is absent, the web server may use authenticated Gemini directly as a temporary analysis fallback. The browser never receives the Gemini key. The server uploads the selected video to Gemini Files API, waits for ACTIVE state, requests structured Spanish coaching JSON, and marks `provider: Gemini` + `usedInReport: true` only after a successful authenticated response and valid JSON parse.

The Gemini/video-AI prompt and post-processing must enforce the clinical-coach premise above: visible facts first, recurring-pattern detection, matchup context, opponent habits, prioritized corrections, actionable drills and timestamp support. It must forbid invented exact punch counts and unsupported certainty.

For production-scale sparring uploads, the web path must not depend on holding a single synchronous HTTP request open while loading the entire file into Next.js memory. Large-video ingestion must move to an asynchronous/private upload path with explicit processing state and recoverable job status.

## 7. Web input contract
Multipart/shared fields aligned with mobile include:
- `video`
- `language`
- `sport`
- `athlete_marker`
- `glove_color` when known
- `stance`

Additional re-identification fields should support Android-equivalent fighter anchoring: `top_color`, `relative_height`, `build`, fighter anchor coordinates/selection and any persistent visual descriptor required by the shared backend.

## 8. Visual coaching
Detected mistakes should link to correction visuals. Product direction supports short motion demos, angle/trajectory graphics and simplified animated teaching examples. Visuals must correspond to the detected issue rather than generic boxing clips. Web and Android should expose the same correction intent even when playback UI differs by platform.

## 9. QA matrix
Before release, validate together:
- Android↔Web feature-parity checklist
- clinical-coach report quality: recurring patterns, matchup context and prioritized corrections rather than generic advice
- video upload/playback
- target fighter selection after upload
- visual fighter identity/re-identification persistence
- discipline/stance/analysis options parity
- dedicated processing state
- timestamp seeking
- analysis rendering
- main takeaway / strengths / priorities / opponent / tactical plan / next goals parity
- asynchronous backend polling and legacy fallback
- shared-backend adapter/runtime smoke
- authenticated Gemini fallback
- ES/EN consistency
- provider labels + `usedInReport`
- CV/Pose/Video-AI source labels and evidence toggle
- drills and visual examples
- PDF export/share
- Android real-app navigation
- responsive web navigation aligned with Android
- web TypeScript + production build
- web Docker build
- public `/api/health`
- deployed `/api/analyze` authenticated Gemini smoke with `provider: Gemini` and `usedInReport: true`
- real large sparring upload/report E2E
- user-visible non-JSON handling for ALB/HTTP errors

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
- GitHub Actions authentication: GitHub OIDC
- deployment role: `FightAIGitHubDeployRole`
- ECS task execution role: `FightAIEcsTaskExecutionRole`
- cluster/service/task family: `fight-ai-web`
- one Fargate task for beta

The workflow creates/reuses the default VPC public subnets, separate ALB/task security groups, ALB target group, listener, ECS cluster/service and immutable ECR image tag by Git commit.

AWS compute is activated and a previous deployment reached ECR push, ALB/ECS deployment and healthy public `/api/health` in `sa-east-1`. The deployment is currently blocked at GitHub OIDC role assumption: even after the local trust-repair script reported success, STS still returns `Not authorized to perform sts:AssumeRoleWithWebIdentity`.

The deploy workflow now includes a safe OIDC diagnostic step before AWS credential configuration. It decodes only non-secret JWT claims (`iss`, `aud`, `sub`, repository/ref/workflow metadata), explicitly compares `sub` with `repo:pinoaraj/fight-ai:ref:refs/heads/web/mvp`, and never prints the token itself. The next deployment run is the source of truth for the exact claim IAM must trust.

`infra/aws/repair-oidc-trust.ps1` remains scoped to the trust relationship only and deliberately does not overwrite existing ECS/ALB/ECR inline permissions. If the diagnostic confirms the expected subject yet STS still rejects the role, the next manual AWS repair must verify the role's effective trust document and the GitHub OIDC provider configuration rather than broadening the role blindly.

Current public beta endpoint from the last healthy deployment: `http://fight-ai-web-alb-2053895073.sa-east-1.elb.amazonaws.com`.

The last verified health response reported `ok: true`, `service: fight-ai-web`, `geminiConfigured: true`, `analysisReady: true`, and `providerAttributionPolicy: usedInReport-required`.

A deployed Gemini smoke must use a real sparring proof clip and pass only when the public `/api/analyze` response returns live Gemini attribution, `usedInReport: true`, a non-empty summary and timestamp evidence. A missing fixture or infrastructure-only health pass does not satisfy this gate.

### Gemini runtime secret status
AWS Secrets Manager and SSM Parameter Store both currently return `SubscriptionRequiredException` for this account. For the beta deployment only, the GitHub Actions `GEMINI_API_KEY` secret is injected as a server-side ECS task environment variable. It is never committed to Git and is never sent to browser JavaScript. Migrate it to Secrets Manager/SSM when those services become available for the account.

### Next production hardening
- add HTTPS with ACM certificate + port 443 before general public launch
- move Gemini key to AWS managed secret storage
- implement private asynchronous large-video upload/job processing (prefer private S3 + short-lived URLs/retention policy once account access permits)
- add CloudWatch logs/metrics before external beta debugging
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
1. `qa/cloud-android`: close authenticated Gemini + Android virtual-agent release gates and preserve Android as the canonical product-flow reference.
2. `web/mvp`: replace the simplified MVP presentation with Android-parity upload → fighter selection → analysis options → processing → report → evidence/visuals → PDF flow.
3. Use the safe OIDC claim diagnostic to resolve the effective IAM trust mismatch, then rerun ECS/ALB deployment and the real deployed Gemini smoke.
4. Harden large-video ingestion so real sparring files do not rely on one memory-heavy synchronous request; add persistent runtime logging.
5. Deploy/connect the shared CV/Pose analysis backend so mobile and web use the same full engine rather than relying on the web Gemini fallback.
6. Keep both clients aligned to this Grapify spec and the same report contract.
