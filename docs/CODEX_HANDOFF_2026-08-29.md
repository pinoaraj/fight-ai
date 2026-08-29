# Fight AI — Android / Codex handoff (2026-08-29)

## Canonical branches

- Android beta and emulator QA: `qa/cloud-android` (this branch)
- Web beta: `web/mvp`
- Shared product/analysis contract: `docs/GRAPIFY_BETA_SPEC.md` on `web/mvp`

Continue from the current Android implementation; do not restart the app from scratch. This branch contains the Expo/React Native client, emulator bootstrap/QA automation, and the system-crash-dialog handling added for reliable cloud/emulator regression runs.

## Cross-platform contract

Android and web must converge on the same semantics for:

- explicit target fighter selection / visual anchor;
- glove and clothing descriptors, relative height/build and free notes;
- sport, stance and language;
- user-selected coach focus;
- provider status and truthful `usedInReport` attribution;
- diagnosis/main takeaway;
- strengths to exploit;
- only the three highest-impact technical priorities;
- opponent patterns and tactical/rematch plan;
- drills tied to detected priorities;
- timestamped evidence with observation and correction;
- Visual Coach aids tied to the detected mistake.

## Product rules that must not regress

- No fabricated punch counts, percentages, speed or precision statistics.
- Separate visible facts from hypotheses.
- Keep the selected fighter identity through anchor + descriptors + temporal continuity; omit uncertain windows rather than switching athletes.
- Coaching chain: visible observation → recurring pattern → consequence → correction → drill → timestamp evidence.
- Provider labels are evidence-based; Gemini is credited only when it actually participates in the report.
- Visual correction guidance should include specific examples/trajectory diagrams or short demonstrations rather than generic decoration.
- Run automated Android emulator QA before release; do not shift regression burden back to manual user testing.

## Web parity reference

`web/mvp` now contains visible decoded-frame marking, descriptor/focus controls, raw streamed large-video upload to Gemini, stronger clinical coaching prompts, reproducible evidence playback, a demonstration video, printable Visual Coach diagrams and desktop/mobile Playwright regression coverage. Treat those semantics as the current web reference while keeping Android-native interaction patterns.

## Codex starting order

1. Read this file and `docs/GRAPIFY_BETA_SPEC.md` from `web/mvp`.
2. Run the existing Android QA/bootstrap path before structural changes.
3. Preserve working emulator crash-dialog handling.
4. Align report/provider/evidence schema with web without introducing a second incompatible contract.
5. Keep Android and web docs synchronized in the same change set.
