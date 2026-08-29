# Fight AI — Codex handoff (2026-08-29)

## Canonical branches

- Web beta: `web/mvp`
- Android beta / emulator QA: `qa/cloud-android`
- Shared product/analysis contract: `docs/GRAPIFY_BETA_SPEC.md` on `web/mvp`

Do not restart either client from scratch. Continue from these branches and preserve the shared report semantics, fighter identity controls, truthful provider attribution and evidence-first coaching contract.

## Web checkpoint

The web beta is Next.js/React/TypeScript and is deployed through GitHub OIDC to AWS ECR + ALB + ECS Fargate. The browser supports local MP4 preview, automatic non-zero decoded frame selection, visual fighter marking, fighter descriptors, stance/sport/language, coach-focus controls, staged analysis progress, Gemini-backed clinical report generation, Visual Coach teaching aids, reproducible evidence playback, captured evidence frames and printable/PDF diagrams.

Large-video direct-Gemini flow is intentionally split:

1. browser sends raw video bytes to `/api/upload` with content type + size/name headers;
2. server streams the incoming request body to Gemini resumable upload without `arrayBuffer()` duplication;
3. browser sends the returned Gemini file reference plus fighter/context fields to `/api/analyze-uploaded`;
4. server waits for ACTIVE state and generates the report.

When `FIGHT_AI_API_URL` is configured, `/api/analyze` remains the shared-backend adapter. Provider labels are truthful: Gemini is shown only when `usedInReport: true`.

## Web regression gate

Keep these green before merging/releasing:

- TypeScript + production build;
- real MP4 reaches `readyState >= 2`, non-zero dimensions and non-zero preview time;
- fighter marking works on the decoded visible frame;
- raw streamed browser upload path is explicitly tested and must not fall back to multipart `/api/analyze` when direct Gemini is selected;
- desktop + Pixel-class Playwright agent flows;
- uploaded-video evidence player seeks to a visible timestamp;
- demo report includes a playable demonstration video;
- printable Visual Coach diagrams remain in PDF/print output;
- production Docker build;
- AWS OIDC deployment;
- public `/api/health`;
- deployed real Gemini smoke with `provider: Gemini`, `usedInReport: true`, diagnosis and timestamp evidence.

## Android checkpoint

`qa/cloud-android` contains the current Expo/React Native Android client plus emulator QA/bootstrap scripts. Android remains the interaction baseline for target-fighter selection, provider participation status, report semantics and Visual Coach intent. Preserve the emulator crash-dialog handling and existing regression automation rather than replacing it with manual-only QA.

The next Codex pass should align Android with the web contract instead of creating separate schemas. Shared fields of interest include athlete marker/anchor, glove/clothing descriptors, relative height/build, stance, sport, language, analysis focus, provider + `usedInReport`, summary, strengths, top priorities, opponent reading, tactical plan, drills and timestamp evidence.

## Product rules that must not regress

- No invented punch counts, percentages, speed or precision statistics.
- Separate visible facts from tactical hypotheses.
- Maintain the selected fighter identity by visual anchor + descriptors + temporal continuity; discard uncertain evidence rather than silently switching athletes.
- Coaching must connect observation → recurring pattern → consequence → correction → drill → timestamp evidence.
- Prioritize the three highest-impact corrections rather than generic advice.
- Evidence must replay against the same uploaded local video.
- Visual teaching aids should be specific to the detected mistake; printable diagrams must survive PDF output.
- Never expose Gemini or AWS credentials to browser/mobile source. AWS deploy stays OIDC-based with short-lived credentials.

## Recommended Codex starting order

1. Read `docs/GRAPIFY_BETA_SPEC.md` and this file.
2. Check latest CI/deploy status on `web/mvp` before changing code.
3. Run/extend the web regression suite when touching preview, upload, evidence, PDF or report rendering.
4. Compare `qa/cloud-android` contract/UI against web and converge shared semantics without rewriting working Android QA.
5. Keep documentation synchronized with behavior in the same change.
