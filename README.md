# Fight AI Web

Web client for the Fight AI combat-sparring analysis platform.

## Status — local-PC beta operativa (2026-09-08)

Canonical and active local-server branch: `web/mvp`
PR #2 remains the historical controlled-cloud beta baseline.

Latest operational verification (2026-09-08): the exact 274.6 MB HEVC regression video completed locally in 137 seconds. The fighter marked on the right was confirmed as the red/white-gloves athlete at 98% identity confidence; the report explicitly distinguished the black-gloves opponent, rendered five real JPEG evidence moments, and enabled print/PDF export. The branded `FIGHT AI` website logo and desktop shortcut are installed. TypeScript, production build, and the desktop/mobile Playwright virtual-agent gate pass (16 passed, 2 device-specific skips).

The web beta is cleared for controlled beta testing. Latest validated baseline:
- Web MVP CI #432/#433: PASS on the final documented HEAD;
- TypeScript + Next.js production build: PASS;
- shared-backend runtime QA: PASS;
- Playwright desktop + Pixel-class mobile journeys: PASS;
- production Docker build: PASS;
- AWS GitHub OIDC deploy #137: PASS;
- CloudFront HTTPS + ECS health: PASS;
- Web Streaming Production Smoke #75: PASS;
- real multipart S3 → durable DynamoDB job → ECS worker → Gemini → report flow: PASS;
- truthful Gemini attribution with `usedInReport=true` and timestamp evidence: PASS.

## Current architecture

Primary beta target:

Browser / phone on the same LAN → Fight AI Web on the Windows PC → local FFmpeg 0:00–3:00 preparation → Fight AI Boxing Knowledge Engine → Gemini → coaching report.

Set `FIGHT_AI_RUNTIME=local` to activate this path. In local mode the normal analysis flow does **not** use S3, DynamoDB, ECS, ALB or CloudFront. Temporary source/clip files are created on the PC and deleted in a `finally` cleanup after the analysis attempt.

AWS code is intentionally preserved as an optional/historical cloud path until the local beta has completed regression testing. Do not delete the cloud infrastructure yet.

See `docs/LOCAL_PC_SERVER.md` and launch with `INICIAR_FIGHT_AI_LOCAL.cmd`.

## Product baseline

- Next.js 15.5.24 + React 19 + TypeScript
- target fighter visual anchor + descriptors
- boxing/kickboxing, stance, language and coach focus
- truthful provider attribution with `usedInReport`
- strengths, top priorities, opponent reading, tactical plan and drills
- timestamped evidence and reproducible playback
- HEVC-compatible selection/evidence JPEGs
- Visual Coach diagrams and correction references
- PDF/print gate waits for real evidence images
- phase-by-phase durable analysis progress
- local Windows server mode with FFmpeg preprocessing
- hybrid boxing-knowledge retrieval + Gemini clinical review
- AWS transport retained only as optional legacy/cloud path
- no static AWS credentials in source

## Source of truth

Read in this order:
1. `AGENTS.md`
2. `docs/STATUS_2026-08-31.md`
3. `docs/PROJECT_CONTINUITY.md`
4. `docs/GRAPIFY_BETA_SPEC.md`
5. `docs/CODEX_HANDOFF_2026-08-29.md`

Android remains the cross-platform interaction/report-semantics baseline. Web must stay contract-compatible rather than becoming a separate product.

## Beta discipline

Controlled testers may use the HTTPS CloudFront URL. Treat uploaded sparring as private user data. Do not commit videos, Gemini keys, AWS credentials, tokens or generated private evidence.

A beta-ready build is not a general-public-production declaration. Continue real-device regressions, especially large HEVC files, evidence/PDF completeness and fighter identity continuity.

## Latest checkpoint

2026-09-07 local runtime verified on `web/mvp`: the real 274.6 MB HEVC regression video completed in 2 min 24 s for the red-gloves fighter, with truthful Gemini attribution, six timestamp findings, six real JPEG evidence captures and PDF export enabled. Desktop/Pixel virtual agents passed 14 tests (2 device-specific skips). `ABRIR_FIGHT_AI.cmd` is the daily idempotent launcher; `TODO_FIGHT_AI.bat` is reserved for explicit update/external-sharing work.

The former CloudFront hostname no longer resolves and is not the active beta entry point. Use the desktop shortcut or the LAN URL printed by the local launcher; use `COMPARTIR_FIGHT_AI.cmd` only when an external temporary HTTPS link is required.
