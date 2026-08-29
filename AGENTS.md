# Fight AI — Codex instructions

Active branches:

- `qa/cloud-android`: this Android beta / emulator QA branch.
- `web/mvp`: canonical web beta and shared product/analysis contract.

Before editing Android code, read `docs/CODEX_HANDOFF_2026-08-29.md` on this branch, then read `docs/GRAPIFY_BETA_SPEC.md` and `docs/CODEX_HANDOFF_2026-08-29.md` on `web/mvp`.

## Security and access

- Never commit or print AWS credentials, Gemini API keys, passwords or long-lived tokens.
- AWS web deployments use GitHub Actions OIDC. Preserve that design.
- Gemini stays server-side; never expose its secret in React Native code.
- Gemini attribution is valid only when `provider: Gemini` and `usedInReport: true`.
- Direct AWS CLI work should use an authenticated SSO/federated/profile session scoped to Fight AI, never repository credential files.

## Product / QA discipline

- Do not rewrite the Android client from scratch.
- Preserve the existing emulator/bootstrap QA path and crash-dialog handling.
- Keep Android report semantics aligned with `web/mvp`.
- Preserve target-fighter identity using anchor/descriptors/temporal continuity.
- Do not fabricate punch counts, percentages, speed or accuracy metrics.
- Coaching should follow observation → recurring pattern → consequence → correction → drill → timestamp evidence.
- Prefer automated emulator regression over manual-only validation.
- Update shared Markdown docs when behavior changes.
