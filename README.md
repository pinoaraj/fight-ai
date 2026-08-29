# Fight AI Web

Web client for the Fight AI combat-sparring analysis platform.

## Current status

Working branch: `web/mvp`

End-of-day status: `docs/STATUS_2026-08-28.md`

Living product/architecture spec: `docs/GRAPIFY_BETA_SPEC.md`

## Current web baseline

- Next.js 15.5.24 + React 19 + TypeScript
- local video upload/playback
- target fighter selection
- boxing/kickboxing + stance inputs
- timestamped coaching report
- strengths, priorities, opponent analysis, tactical plan and drills
- explicit provider attribution with `usedInReport`
- shared-backend adapter
- server-side Gemini fallback
- HEVC-compatible frame selection and server-rendered evidence JPEGs for PDF
- visible analysis ETA, elapsed time and phase-by-phase progress
- HTTPS public entry point provisioned through CloudFront for Android/iOS
- CI + Docker build
- AWS deploy through GitHub OIDC
- CloudFront + ECR + ECS/Fargate + ALB
- public health endpoint

## Product rule

The Android client remains the source of truth for product flow and report hierarchy. The web client must reach Android parity rather than evolve into a separate product.

## Next

The web code should be migrated from this branch into the dedicated repository:

`pinoaraj/fight-ai-web`

After migration, update AWS GitHub OIDC trust to the new repository subject before enabling deploys from the new repo.

## Security

Do not commit private sparring footage, Gemini keys, AWS credentials or other secrets.
