# Fight AI AWS deploy notes

- 2026-08-29: GitHub OIDC custom subject verified and AWS role assumption succeeds.
- ECR push, ALB provisioning, and ECS Fargate service deployment succeed.
- Public `/api/health` returns `ok: true`, `geminiConfigured: true`, and `analysisReady: true`.
- The previous deploy failed only because the Gemini smoke fixture file was absent from the checked-out commit.
- Added `qa/gemini-proof-red-gloves-tiny.b64` as a tiny synthetic boxing transport fixture so the deployed `/api/analyze` path can be exercised against real Gemini without private user footage.
- A separate real sparring-video E2E gate remains required before calling the website fully verified.
