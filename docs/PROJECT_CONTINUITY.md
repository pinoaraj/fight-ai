# Fight AI — Project continuity guide

This repository is the source of truth for continuing Fight AI from Codex, OpenCode, Claude, Google AI Studio or another coding agent. Read this file first, then the linked product and handoff documents before changing code.

## Canonical starting point

- Repository: `pinoaraj/fight-ai`
- Web and shared contract branch: `web/mvp`
- Android QA branch: `qa/cloud-android`
- Product authority: `docs/GRAPIFY_BETA_SPEC.md`
- Detailed operational handoff: `docs/CODEX_HANDOFF_2026-08-29.md`
- Repository rules: `AGENTS.md`

Do not restart either client or invent a second report schema. Keep Android and web aligned around the same fighter identity, provider attribution and evidence-first report contract.

## Current web behavior

1. The browser splits the selected sparring into 8 MB parts and uploads them directly to the private S3 ingest bucket through short-lived signed URLs. The large MP4 never travels through CloudFront/ALB/ECS as a single viewer request.
2. The browser starts `/api/analyze-uploaded?async=1`, receives a durable job descriptor (`id`, `status`) and polls for the final report. ECS reads the private S3 object and streams it to Gemini.
3. A report credits Gemini only with `provider: "Gemini"` and `usedInReport: true`.
4. HEVC/Main10 or another browser-incompatible codec uses server-side FFmpeg JPEG captures for fighter selection and evidence. It must never require the athlete to select a fighter from a black video surface.
5. PDF download remains disabled until every report timestamp has a real evidence image. The report and PDF must never substitute black boxes or fabricated images for evidence.

## Handoff status — 2026-08-29

AWS resources for the durable large-video path exist: private encrypted S3 bucket `fight-ai-video-ingest-379549361550-sa-east-1` (two-day lifecycle), DynamoDB table `fight-ai-analysis-jobs`, and ECS task role `FightAIEcsTaskRole`. The bootstrap is `infra/aws/bootstrap-large-video-ingestion.ps1`.

The web client uses multipart S3 upload and `/api/analyze-uploaded` persists every job in DynamoDB. A conditional lease makes an active job recoverable after an ECS restart: a later poll can claim an expired lease and resume it without a second video upload. Jobs expire after two days. S3 CORS is applied for the CloudFront mobile origin and DynamoDB TTL is enabled. The remaining release gate is the exact HEVC 275 MB Android/CloudFront journey through report evidence and PDF. Do not give public-mobile green light until that journey is successful.

## Deploy and mobile access

The deployment path is GitHub Actions OIDC → ECR → ECS Fargate → ALB origin → CloudFront HTTPS. GitHub Actions workflow: `.github/workflows/web-aws-deploy.yml`.

- Use the generated `https://*.cloudfront.net` domain for Android and iOS.
- The ALB HTTP URL is an origin/debug endpoint only; do not share it as the mobile product URL.
- CloudFront permissions are applied to `FightAIGitHubDeployRole` by `infra/aws/grant-cloudfront-https-permissions.ps1` from an authorized AWS profile. Re-run it whenever the tracked policy changes, including its `freetier:GetAccountPlanState` eligibility permission.
- Never commit or expose AWS credentials, Gemini keys, uploaded sparring videos or access tokens.

## Required verification before release

```powershell
npm run typecheck
npm run build
```

For changes that affect upload, analysis, frame extraction or PDF, also validate a real video workflow: visible fighter selection, async report completion, evidence JPEGs for every report timestamp, and PDF export only after the image counter completes. Check the latest GitHub Actions deploy and `/api/health` before sharing a public URL.

## Known beta limitations and next hardening work

- Async job state is stored in ECS process memory: it does not survive a container restart or browser reload.
- The current upload/reference flow is suitable for the beta but needs durable ingestion, queue and job storage before a broad public launch.
- Replace the temporary CloudFront domain with the product domain and ACM certificate when a brand domain is chosen.
- Keep coaching factual: no invented punch counts, accuracy, speed, percentages or unsupported certainty.

## Safe task prompt for a new coding agent

Use this as the first instruction in a new session:

> Work in `pinoaraj/fight-ai` on branch `web/mvp`. Read `AGENTS.md`, `docs/PROJECT_CONTINUITY.md`, `docs/GRAPIFY_BETA_SPEC.md`, and `docs/CODEX_HANDOFF_2026-08-29.md` before editing. Preserve the shared Android/web report contract, OIDC deployment, truthful Gemini attribution, HEVC-compatible evidence JPEGs, and PDF image gate. Inspect the latest GitHub Actions deployment before making changes. Do not expose secrets or add fabricated analysis metrics.
