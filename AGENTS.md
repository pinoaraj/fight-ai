# Fight AI — Codex instructions

This repository has two active product branches:

- `web/mvp`: canonical web beta and shared product/analysis contract.
- `qa/cloud-android`: current Expo/React Native Android beta and emulator QA.

Before editing code, read `docs/CODEX_HANDOFF_2026-08-29.md`. On `web/mvp`, also read `docs/GRAPIFY_BETA_SPEC.md`; it is the cross-platform product authority.

## Security and access

- Never commit or print AWS credentials, Gemini API keys, passwords or long-lived tokens.
- Web deployments use GitHub Actions OIDC and the existing AWS IAM role. Preserve that architecture.
- Gemini runs server-side only. Never move its secret into browser/mobile code.
- Credit Gemini in a report only when `provider: Gemini` and `usedInReport: true` are both present.
- For direct AWS CLI work, use an already-authenticated SSO/federated/profile session scoped to Fight AI. Do not create credential files in the repo.

## Release discipline

- Do not restart either client from scratch.
- Keep Android and web report semantics compatible.
- No fabricated punch counts, percentages, speed or accuracy metrics.
- Keep observation, hypothesis and correction distinguishable.
- Preserve target-fighter identity through anchor/descriptors/temporal continuity.
- Coaching should follow observation → recurring pattern → consequence → correction → drill → timestamp evidence.
- Run existing automated QA before declaring a change ready.
- When behavior changes, update the relevant Markdown specification/handoff in the same change.

## Web gates

For changes to `web/mvp`, keep TypeScript/build, desktop/mobile Playwright agent journeys, production container build, streamed upload path, visible video preview/marking, evidence playback, PDF/print diagrams, public health and truthful Gemini smoke behavior green.

## Android gates

For changes to `qa/cloud-android`, preserve the existing emulator/bootstrap regression path and crash-dialog handling. Prefer automated emulator QA over manual-only testing.


## Controlled beta status

As of 2026-09-01, web controlled-beta gates are green. Public HTTPS beta: https://d1ga34t3tjgix2.cloudfront.net

Canonical large-video behavior is private multipart S3 → DynamoDB durable job → ECS worker → 0:00–3:00 FFmpeg stream copy → Gemini. Gemini Files is primary; compact inline Interactions is only a capacity fallback when Files upload cannot create a reusable reference. Do not regress to process-memory-only jobs, request-lifecycle processing, repeated full re-uploads or full HEVC transcoding as the default.

For release-affecting web changes, require green Web MVP CI and the applicable AWS deploy/production smoke before declaring beta-ready again.

Latest verified web gates: Web MVP CI #432/#433 PASS, AWS Deploy #137 PASS, Production Streaming Smoke #75 PASS. Production smoke must tolerate transient ECS rollout resets but still fail on persistent runtime/network errors or an unsuccessful durable Gemini report.
