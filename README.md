# Fight AI Web

Web client for the Fight AI combat-sparring analysis platform.

## Status — controlled beta ready (2026-08-31)

Canonical branch: `web/mvp`  
PR: #2  
Public HTTPS beta: https://d1ga34t3tjgix2.cloudfront.net

The web beta is cleared for controlled beta testing. The release gate has passed:
- TypeScript + Next.js production build;
- shared-backend runtime QA;
- Playwright desktop + Pixel-class mobile journeys;
- real MP4 preview and fighter marking;
- multipart private S3 upload;
- durable DynamoDB job + ECS worker recovery;
- Docker production build;
- AWS GitHub OIDC deploy;
- CloudFront HTTPS + ECS health;
- deployed Gemini red-gloves smoke with `usedInReport=true` and timestamp evidence.

## Current architecture

Browser → signed multipart S3 upload → DynamoDB durable job → ECS worker → 0:00–3:00 stream-copy clip → Gemini → evidence-first coaching report.

The original upload remains private and intact in S3. Long-running analysis does not depend on the browser request staying open. HEVC/Main10 is not fully transcoded by default.

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
- private S3 + DynamoDB TTL
- ECS/Fargate + ALB + CloudFront HTTPS
- GitHub Actions OIDC; no static AWS credentials in source

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
