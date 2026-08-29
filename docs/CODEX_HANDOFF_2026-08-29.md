# Fight AI — Codex handoff (2026-08-29)

## Canonical branches

- Web beta: `web/mvp`
- Android beta / emulator QA: `qa/cloud-android`
- Shared product/analysis contract: `docs/GRAPIFY_BETA_SPEC.md` on `web/mvp`

Do not restart either client from scratch. Continue from these branches and preserve the shared report semantics, fighter identity controls, truthful provider attribution and evidence-first coaching contract.

## Access and infrastructure contract for Codex

Codex should operate through the existing repository and short-lived/federated credentials only. Do **not** add long-lived AWS keys, Gemini keys, passwords or tokens to source control.

### GitHub

- Repository: `pinoaraj/fight-ai`
- Web development branch: `web/mvp`
- Android development/QA branch: `qa/cloud-android`
- Current web PR: #2 into `main`
- Web CI workflow: `.github/workflows/web-ci.yml`
- AWS deployment workflow: `.github/workflows/web-aws-deploy.yml`
- Production streaming smoke workflow: `.github/workflows/web-streaming-smoke.yml`
- GitHub Actions deploy authentication uses AWS OIDC. Preserve this design.

Codex must be connected to the same GitHub account/repository with permission to read/write branches and workflows. The repository itself contains all non-secret configuration needed to understand the deployment.

### AWS

Current beta architecture: GitHub Actions OIDC → Amazon ECR → ECS Fargate → Application Load Balancer origin → CloudFront HTTPS entry point.

- AWS account: use the account already authorized by the GitHub OIDC role; do not hard-code account credentials.
- ECS / ALB region: `sa-east-1`
- ECR region: `us-east-2`
- GitHub deploy IAM role: `FightAIGitHubDeployRole`
- ECS task execution role: `FightAIEcsTaskExecutionRole`
- ALB origin/debug URL: `http://fight-ai-web-alb-2053895073.sa-east-1.elb.amazonaws.com`
- Public mobile URL: the `https://*.cloudfront.net` domain printed by the current deploy workflow. The workflow subscribes it to the CloudFront FREE plan with its required WAF ACL; do not share the ALB HTTP URL with Android/iOS users.
- ALB idle timeout for long analysis: 1200 seconds
- Current ECS task sizing for web beta: 1 vCPU / 3 GB RAM; Node heap capped near 2304 MB

For normal deployment, Codex should change code/workflows and let GitHub Actions assume `FightAIGitHubDeployRole` through OIDC. No static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` belongs in the repository.

If direct AWS CLI work is later required from a Codex local environment, use an authenticated AWS profile/SSO/federated session scoped to Fight AI resources. A one-time user login/authorization may be required in that environment; the repository must never become the credential store.

### Gemini / AI runtime

- Gemini runs server-side only.
- `GEMINI_API_KEY` is supplied to the deployment as a secret; never expose it to browser/mobile code, logs, docs or commits.
- Gemini may be credited in a report only when the runtime response has `provider: "Gemini"` and `usedInReport: true`.
- `FIGHT_AI_API_URL`, when configured, switches `/api/analyze` to the shared-backend adapter path.

### Safe diagnostics

Codex may inspect workflow/job status, HTTP status, health payloads and sanitized error classes. Do not print secret values or full credential material while debugging.

## Web checkpoint

The web beta is Next.js/React/TypeScript and is deployed through GitHub OIDC to AWS ECR + ALB + ECS Fargate. The browser supports local MP4 preview, automatic non-zero decoded frame selection, visual fighter marking, fighter descriptors, stance/sport/language, coach-focus controls, staged analysis progress, Gemini-backed clinical report generation, Visual Coach teaching aids, reproducible evidence playback, captured evidence frames and printable/PDF diagrams.

Large-video direct-Gemini flow is intentionally split:

1. browser sends raw video bytes to `/api/upload` with content type + size/name headers;
2. server streams the incoming request body to Gemini resumable upload without `arrayBuffer()` duplication;
3. browser sends the returned Gemini file reference plus fighter/context fields to `/api/analyze-uploaded`;
4. browser starts `/api/analyze-uploaded?async=1`; server waits for ACTIVE state and generates the report in a short-lived in-memory job;
5. browser polls the job endpoint until it receives the final report.

This async wrapper exists because CloudFront custom origins have a finite response timeout. It avoids holding a viewer POST open while Gemini reviews a long sparring. It is beta-grade only: jobs do not survive an ECS restart or browser reload, so keep the planned durable queue/job store on the roadmap.

For browser-incompatible codecs (notably HEVC Main 10), `/api/preview-frame` creates the selectable JPEG and `/api/evidence-frames` creates up to four JPEG evidence thumbnails at the report's own timestamps. The source bytes are staged only on ephemeral task storage and removed after extraction; these thumbnails let the print/PDF view retain real video evidence instead of fabricated placeholders.

When `FIGHT_AI_API_URL` is configured, `/api/analyze` remains the shared-backend adapter. Provider labels are truthful: Gemini is shown only when `usedInReport: true`.

## Web regression gate

Keep these green before merging/releasing:

- TypeScript + production build;
- real MP4 reaches `readyState >= 2`, non-zero dimensions and non-zero preview time;
- fighter marking works on the decoded visible frame;
- raw streamed browser upload path is explicitly tested and must not fall back to multipart `/api/analyze` when direct Gemini is selected;
- desktop + Pixel-class Playwright agent flows;
- uploaded-video evidence player seeks to a visible timestamp;
- demo report includes a playable demonstration video;
- printable Visual Coach diagrams remain in PDF/print output;
- production Docker build;
- AWS OIDC deployment;
- public `/api/health`;
- deployed real Gemini smoke with `provider: Gemini`, `usedInReport: true`, diagnosis and timestamp evidence.

## Android checkpoint

`qa/cloud-android` contains the current Expo/React Native Android client plus emulator QA/bootstrap scripts. Android remains the interaction baseline for target-fighter selection, provider participation status, report semantics and Visual Coach intent. Preserve the emulator crash-dialog handling and existing regression automation rather than replacing it with manual-only QA.

The next Codex pass should align Android with the web contract instead of creating separate schemas. Shared fields of interest include athlete marker/anchor, glove/clothing descriptors, relative height/build, stance, sport, language, analysis focus, provider + `usedInReport`, summary, strengths, top priorities, opponent reading, tactical plan, drills and timestamp evidence.

## Product rules that must not regress

- No invented punch counts, percentages, speed or precision statistics.
- Separate visible facts from tactical hypotheses.
- Maintain the selected fighter identity by visual anchor + descriptors + temporal continuity; discard uncertain evidence rather than silently switching athletes.
- Coaching must connect observation → recurring pattern → consequence → correction → drill → timestamp evidence.
- Prioritize the three highest-impact corrections rather than generic advice.
- Evidence must replay against the same uploaded local video.
- Visual teaching aids should be specific to the detected mistake; printable diagrams must survive PDF output.
- Never expose Gemini or AWS credentials to browser/mobile source. AWS deploy stays OIDC-based with short-lived credentials.

## Recommended Codex starting order

1. Connect Codex to the same GitHub account and open `pinoaraj/fight-ai`.
2. Read `docs/GRAPIFY_BETA_SPEC.md` and this file.
3. Check latest CI/deploy status on `web/mvp` before changing code.
4. Run/extend the web regression suite when touching preview, upload, evidence, PDF or report rendering.
5. Compare `qa/cloud-android` contract/UI against web and converge shared semantics without rewriting working Android QA.
6. Keep documentation synchronized with behavior in the same change.
7. Use GitHub OIDC for AWS deployments; only establish a local AWS SSO/profile session if a task truly requires direct AWS CLI access.
