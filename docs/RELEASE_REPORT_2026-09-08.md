# Fight AI local beta release report — 2026-09-08

## Outcome

The Windows-hosted responsive web beta is operational for PC, Android and iOS browsers on the same LAN. The exact regression round `20260827_204921.mp4` (274.6 MB, HEVC, 3:05 source) completed against the local Gemini path in 137 seconds while analyzing only the first 3:00.

## Fighter-identity correction

The athlete selected on the right at 00:05 was the fighter with red/white gloves, white headgear and dark clothing. The returned report confirmed this athlete at 98% confidence and explicitly distinguished the opponent with black gloves.

The root cause was that segmented-video prompts did not repeat the original anchor geometry and merged segments without a machine-enforced identity contract. The repair adds:

- original anchor x/y, radius, frame time and frame size to every segment prompt;
- required `targetIdentity` output with requested/observed glove family, anchor match, confidence and notes;
- required `targetMatch` on every evidence finding;
- server rejection for conflicts, unconfirmed marked anchors, glove mismatch or confidence below 0.60;
- client validation before any real report is rendered;
- identity badge in the web report and printable/PDF output.

## Operational evidence

- Provider: Gemini, used in the report.
- Gemini preparation: 12.5 s.
- Coaching generation: 51.9 s.
- Total server time: 137 s.
- Evidence: five timestamped findings with five real JPEG captures.
- Visual teaching: three coach diagrams included in the printable report.
- PDF action: enabled only after every evidence frame is ready.

## Knowledge catalog

The hybrid engine now includes the versioned catalog `2026.09.07-v1` with eight source-linked programs/institutions: Liverpool John Moores University, Edge Hill University, INSEP, USA Boxing, England Boxing, GB Boxing, Gleason's Gym and Wild Card Boxing Club. The catalog supplies documented context; it is not a ranking, endorsement or substitute for evidence from the uploaded round.

## Branding and launcher

- Website header: branded gold/black glove-and-reticle `FIGHT AI` logo.
- Desktop: `C:\Users\JP\Desktop\Fight AI Beta.lnk` with branded icon and name.
- Daily launcher: `ABRIR_FIGHT_AI.cmd`.
- PC URL: `http://localhost:8787`.
- LAN URL used for phone testing: `http://192.168.4.81:8787` (the PC and phone must be on the same network; the LAN IP can change after reconnecting).

## Verification gate

- TypeScript: PASS.
- Next.js production build: PASS.
- Playwright desktop/mobile virtual agents: 16 passed, 2 device-specific skips.
- Real HEVC upload, frame marking, red-fighter identity, report generation and JPEG evidence: PASS.

## Graphify continuity

`docs/GRAPIFY_BETA_SPEC.md` is the maintained graph-ready product/architecture source and now includes the strict target-identity contract and boxing-program catalog. Local Graphify extraction is not claimed as generated because the installed CLI requires a supported provider key (`MOONSHOT_API_KEY` or `ANTHROPIC_API_KEY`) that is not configured; the Markdown source remains complete for Graphify, OpenCode, Google AI Studio, Claude or another coding agent.
