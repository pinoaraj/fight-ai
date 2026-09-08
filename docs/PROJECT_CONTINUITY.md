# Fight AI — Project continuity guide

## Canonical starting point

- Repository: `pinoaraj/fight-ai`
- Web/shared branch: `web/mvp`
- Android QA branch: `qa/cloud-android`
- Web PR: #2
- Current status: `docs/STATUS_2026-08-31.md`
- Product authority: `docs/GRAPIFY_BETA_SPEC.md`
- Operational handoff: `docs/CODEX_HANDOFF_2026-08-29.md`
- Repository rules: `AGENTS.md`
- Active PC URL: `http://localhost:<selected-port>` (normally 8787)
- Active LAN URL: printed by `ABRIR_FIGHT_AI.cmd` / `scripts/start-local.ps1`
- Historical CloudFront URL: retired/unavailable as of 2026-09-07; do not share it

Do not restart either client or create a second analysis schema.

## Web architecture now

1. Browser uploads in 8 MB parts directly to the private S3 ingest bucket using signed multipart URLs.
2. Browser starts `/api/analyze-uploaded?async=1` and receives a durable job ID.
3. DynamoDB persists payload/status/report with TTL and lease fields.
4. The ECS worker scans every 5 seconds, claims queued/expired work and continues independently of the browser HTTP lifecycle.
5. Worker downloads the private original and uses FFmpeg stream copy for the first 0:00–3:00; do not default back to CPU-heavy HEVC Main10 transcoding.
6. The temporary round clip is uploaded to Gemini; UI phases map to downloading → converting/cutting → uploading → preparing → coaching.
7. Gemini is credited only when `provider: "Gemini"` and `usedInReport: true`.
8. HEVC/browser-incompatible preview/evidence uses real server-extracted JPEGs. PDF remains blocked until real evidence images are ready.
9. Original upload remains private and intact; a deploy/restart must reuse the same S3 object/job instead of requesting a second upload.
10. The workflow strip is an ordered guide: pulse only the next required action — **Subir video → Seleccionar peleador → Características → Foco del coach → Analizar sparring** — then switch to report progress.

## Verified beta gate — 2026-08-31

- Web MVP CI #297 and #298: PASS.
- Typecheck/build/runtime QA: PASS.
- Playwright desktop + mobile: PASS.
- Production Docker build: PASS.
- AWS deploy #82: PASS.
- CloudFront HTTPS: PASS.
- ECS stabilization: PASS.
- Public health: `geminiConfigured=true`, `analysisReady=true`.
- Deployed red-gloves Gemini smoke: PASS, `usedInReport=true`, 4 evidence items.
- Streaming production smoke on durable uploaded-reference path: PASS.

Public controlled-beta URL: https://d1ga34t3tjgix2.cloudfront.net

## CloudFront note

The existing distribution is healthy. AWS reports the distribution is not eligible for the optional CloudFront FREE-plan subscription. The workflow therefore treats plan enrollment as optional and continues to verify HTTPS. Do not confuse FREE-plan eligibility with HTTPS readiness.

## Release discipline

Before changing preview/upload/jobs/evidence/PDF/provider behavior, preserve:
- fighter identity anchor + descriptors + temporal continuity;
- no fabricated counts/percentages/speed/accuracy;
- observation → pattern → consequence → correction → drill → timestamp evidence;
- truthful provider attribution;
- durable retry without re-upload;
- real evidence frames in PDF;
- automated CI plus deployed smoke for release-affecting changes.

Controlled beta is approved; broad public launch is not. Continue real-device HEVC and PDF regressions and add observability before widening access.

## Local closure checkpoint — 2026-09-07

- Desktop shortcut `Fight AI Beta.lnk` targets `ABRIR_FIGHT_AI.cmd`, reuses a healthy process and opens localhost.
- The icon is stored outside the repo in `%LOCALAPPDATA%\FightAI`, while its source asset is versioned under `assets/desktop/`.
- The previous installer split between `C:\Users\JP\fight-ai` and the Desktop copy was corrected: its default is now `$PSScriptRoot`.
- The real 274.6 MB HEVC video completed for the red-gloves fighter in 2 min 24 s with six evidence captures and PDF readiness.
- Cloud retry now supports the explicit transition `failed → queued` without a second upload and respects provider backoff leases.

## Operational identity checkpoint — 2026-09-08

- The exact `20260827_204921.mp4` regression (274.6 MB HEVC) completed locally in 137 seconds.
- The visually marked athlete on the right was confirmed as the red/white-gloves fighter at 98% confidence; the report explicitly separated the black-gloves opponent.
- Five evidence timestamps produced five real JPEG frames, and PDF/print export unlocked only after all frames were ready.
- Reports and each evidence item now carry a strict target-identity contract. Conflicts, uncertain marked anchors, glove mismatch, or confidence below 0.60 are rejected instead of showing analysis for the wrong fighter.
- The hybrid catalog is versioned as `2026.09.07-v1`; see `docs/BOXING_PROGRAM_CATALOG.md`.
- The site header and `Fight AI Beta.lnk` use the branded `FIGHT AI` glove/reticle logo.
- Final local gate: TypeScript PASS, production build PASS, Playwright desktop/mobile virtual agents 16 passed and 2 device-specific skips.


## Continuity checkpoint — 2026-09-01

The latest validated web baseline adds two production hardenings without changing the product/report contract:
- Gemini Files is still primary, with compact inline Interactions fallback only when Files upload capacity (`429/503`) prevents creation of a reusable Gemini file reference.
- The production smoke waits for three consecutive healthy responses from the expected build SHA and retries transient network resets during ECS task replacement.

Validated runs: Web MVP CI #432/#433 PASS on the documented HEAD; runtime code baseline also passed #429/#430, AWS Deploy #137 PASS, Streaming Production Smoke #75 PASS. Continue from this baseline; do not revert to repeated full video re-uploads or treat a single rollout connection reset as an analysis failure.

Current ECS sizing: 2 vCPU / 4 GB for the web task. Gemini model baseline: `gemini-3.6-flash` with `gemini-3.5-flash-lite` fallback. Keep PR #2 open during controlled beta feedback triage.
