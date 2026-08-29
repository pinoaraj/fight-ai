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

1. The browser uploads the selected sparring to `/api/upload`; the server streams it to Gemini.
2. The browser starts `/api/analyze-uploaded?async=1`, receives a job descriptor (`id`, `status`) and polls for the final report.
3. A report credits Gemini only with `provider: "Gemini"` and `usedInReport: true`.
4. HEVC/Main10 or another browser-incompatible codec uses server-side FFmpeg JPEG captures for fighter selection and evidence. It must never require the athlete to select a fighter from a black video surface.
5. PDF download remains disabled until every report timestamp has a real evidence image. The report and PDF must never substitute black boxes or fabricated images for evidence.

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
