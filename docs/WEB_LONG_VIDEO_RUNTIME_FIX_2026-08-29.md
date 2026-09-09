# Fight AI Web — long-video production hardening

Original incident: 2026-08-29  
Final beta-ready verification: 2026-08-31  
Branch: `web/mvp`

## Incident

Real phone footage exposed three separate weaknesses in the early web path:
1. long synchronous viewer requests could be interrupted;
2. 275 MB HEVC Main10 decoding/transcoding was too CPU-expensive inside ECS;
3. work tied to a short HTTP request could stop making progress after the request/deploy lifecycle changed.

## Final design

The controlled beta no longer depends on the old synchronous large-video path.

- Browser uploads 8 MB multipart chunks directly to private S3.
- DynamoDB persists an async job ID, payload, status, result, TTL and lease.
- An ECS worker scans every 5 seconds and claims queued/expired jobs.
- Worker downloads the private original.
- FFmpeg creates only the first 0:00–3:00 using stream copy; the default path does not re-encode HEVC Main10 pixels.
- Temporary clip goes to Gemini.
- Job phases are visible as downloading → cutting/converting → uploading → preparing → coaching.
- ECS restart/deploy recovery reuses the same S3 object and job ID.
- The original S3 video remains intact and private.
- UI retry must not trigger a second upload.

## Runtime hardening retained

- ECS Fargate: 2 vCPU / 4 GB
- Node heap: approximately 3328 MB
- ALB idle timeout: 1200 seconds
- GitHub OIDC deploy
- ECR private image
- CloudFront HTTPS public entry

These are safety margins, not substitutes for durable processing.

## Verification

2026-08-31:
- Web MVP CI #297/#298 passed desktop/mobile virtual agents and Docker build.
- AWS deploy #82 passed OIDC, ECR, CloudFront, ECS stabilization and public HTTPS verification.
- Public beta: https://d1ga34t3tjgix2.cloudfront.net
- /api/health returned `geminiConfigured=true` and `analysisReady=true`.
- Deployed red-gloves Gemini smoke returned `usedInReport=true` with 4 timestamp evidence items.
- Existing streaming production smoke is green on the durable uploaded-reference path.

## Regression rule

Do not restore full H.264 transcoding as the normal HEVC preparation step. If a source cannot be stream-copied, return an explicit preparation failure or implement a narrowly-scoped fallback with its own timeout/QA. Never hide multi-minute CPU work behind a generic “preparing” status.

Controlled beta is green; broad production still requires continued real-device regression and observability.
