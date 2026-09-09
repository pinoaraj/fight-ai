# Fight AI local beta release report — 2026-09-08

## Outcome

The Windows-hosted responsive web beta is operational for PC, Android and iOS browsers on the same LAN. The exact regression round `20260827_204921.mp4` (274.6 MB, HEVC, 3:05 source) completed against the local Gemini path in 141 seconds while analyzing only the first 3:00.

## Fighter-identity correction

The athlete selected on the right at 00:05 was the fighter with red/white gloves, white headgear and dark clothing. The returned report confirmed this athlete at 98% confidence and explicitly distinguished the opponent with black gloves.

The root cause was that prompt-only geometry and clothing descriptions were not a sufficient visual identity reference across the full round. The repair adds:

- two mandatory Gemini visual references generated from the marked moment: the complete frame with the gold target box and a tight crop of the selected athlete;
- original anchor x/y, radius, frame time and frame size to every segment prompt;
- required `targetIdentity` output with requested/observed glove family, anchor match, confidence and notes;
- required `targetMatch` and a visible `identityBasis` on every evidence finding;
- server rejection for conflicts, unconfirmed marked anchors, glove mismatch or confidence below 0.60;
- a required frame marker in the client before the real analysis can start;
- client validation before any real report is rendered;
- identity badge in the web report and printable/PDF output.

## Operational evidence

- Provider: Gemini, used in the report.
- Gemini upload/preparation: 15.4 s.
- Coaching generation: 45.4 s.
- Total server time: 141.4 s.
- Evidence: four timestamped findings with four real JPEG captures and four explicit identity bases.
- Regression at 01:28: PASS. The report identifies the white Ringside headgear and red Fairtex gloves while describing the selected athlete's body work; it no longer describes the black-glove opponent as the athlete.
- Visual teaching: three coach diagrams included in the printable report.
- PDF action: enabled only after every evidence frame is ready.

## Knowledge catalog

The hybrid engine now includes the versioned catalog `2026.09.07-v1` with eight source-linked programs/institutions: Liverpool John Moores University, Edge Hill University, INSEP, USA Boxing, England Boxing, GB Boxing, Gleason's Gym and Wild Card Boxing Club. The catalog supplies documented context; it is not a ranking, endorsement or substitute for evidence from the uploaded round.

## Branding and launcher

- Website header: branded gold/black glove-and-reticle `FIGHT AI` logo, enlarged to 72 px on desktop and 56 px on mobile with increased header spacing and wordmark legibility.
- Desktop: `C:\Users\JP\Desktop\Fight AI Beta.lnk` with branded icon and name. The shortcut now points to the versioned `FightAI-Beta-v4.ico`, containing ten Windows Shell sizes from 16 to 256 px. Installation recreates the `.lnk`, clears Explorer's icon cache with `ie4uinit`, and sends both item-specific and association refresh notifications. A direct Windows associated-icon probe confirmed that the shortcut resolves to the Fight AI logo rather than the generic `.cmd` icon.
- Daily launcher: `ABRIR_FIGHT_AI.cmd`.
- PC URL: `http://localhost:8787`.
- LAN URL used for phone testing: `http://192.168.4.81:8787` (the PC and phone must be on the same network; the LAN IP can change after reconnecting).
- External supervised beta: run `COMPARTIR_FIGHT_AI.cmd` to create a temporary authenticated HTTPS Cloudflare Tunnel without opening router ports. Use `VER_ACCESO_EXTERNO.cmd` to display the current URL and credentials locally. The free proxy path is limited to videos below 100 MB.

## Verification gate

- TypeScript: PASS.
- Next.js production build: PASS.
- Playwright desktop/mobile virtual agents: 18 passed, 2 device-specific skips, including a stale-verification regression that proves the browser exits instead of polling indefinitely.
- Real HEVC upload, mandatory frame marking, dual visual identity references, red-fighter identity, 01:28 attribution, report generation and JPEG evidence: PASS.

## Graphify continuity

`docs/GRAPIFY_BETA_SPEC.md` is the maintained graph-ready product/architecture source and now includes the strict target-identity contract and boxing-program catalog. Local Graphify extraction is not claimed as generated because the installed CLI requires a supported provider key (`MOONSHOT_API_KEY` or `ANTHROPIC_API_KEY`) that is not configured; the Markdown source remains complete for Graphify, OpenCode, Google AI Studio, Claude or another coding agent.

## Fighter attribution regression — second gate

A later human review found that a 00:26 finding still described the black-glove opponent at the ropes while labeling the red-glove athlete. The prior gate was therefore insufficient because the coaching model was effectively validating its own first interpretation.

The local analysis path now performs a second, image-only verification pass after the initial video analysis. It extracts the exact frame for every proposed timestamp, sends those frames together with the marked full-frame reference and tight athlete crop, and requires a new report. The verifier must state who is at the ropes, advancing or striking; it rewrites swapped-subject claims or removes them, then rebuilds the summary and coaching plan from only the corrected evidence. A report with no independently verified athlete evidence is blocked.

The exact round regression completed in 146.9 seconds. The invalid 00:26 evidence was removed. The final timestamps were 00:18, 01:05, 01:41 and 02:29, and a direct contact-sheet review confirmed that all four descriptions refer to the white-headgear/red-Fairtex-glove athlete. This supersedes the earlier single-pass identity result in this report.

## Interrupted-job recovery — 2026-09-09

A user analysis remained at `verifying` for 16 minutes because the local server was restarted while that job was active. The JSON status survived but the in-memory promise did not, so the browser kept polling an orphaned status. Local jobs now persist their complete string context, detect that their timestamp predates the current server process and automatically resume from the already staged MP4 after a restart. Older jobs created before this metadata existed fail explicitly instead of displaying endless processing. The independent verifier also has a 135-second global budget with at most one bounded attempt per fallback model, replacing a nested retry design whose worst case was 18 minutes.

## Provider-capacity incident — 2026-09-09

The exact persisted HEVC round was submitted again after explicit authorization. The first attempt exposed a transient DNS failure (`EAI_AGAIN`); Gemini control calls now run a bounded DNS/network retry and the provider is checked before expensive FFmpeg preparation. A second regression exposed an incorrect 90-second per-request timeout even though this round normally needs about 140–150 seconds; the useful model request now receives up to 200 seconds inside a 210-second coaching budget.

At final verification, Gemini accepted the uploaded video and reference images as `ACTIVE`, but every available Gemini 3 video model tested returned HTTP 500 with the provider message `currently experiencing high demand`. This is recorded as an external-capacity block, not a successful report. The UI no longer waits 16–25 minutes: stale coaching and verification phases stop after four minutes, and the complete local workflow has an eight-minute ceiling while retaining the staged video for retry. TypeScript, production build and 22 Playwright desktop/mobile scenarios passed (20 passed, 2 device-specific skips), including the new stale-coaching regression.
