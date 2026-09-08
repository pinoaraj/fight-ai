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
- Desktop: `C:\Users\JP\Desktop\Fight AI Beta.lnk` with branded icon and name. The shortcut now points to the versioned `FightAI-Beta-v3.ico`, containing ten Windows Shell sizes from 16 to 256 px. Installation recreates the `.lnk` and forces a Shell association refresh. A direct `SHGetFileInfo` probe confirmed that Windows resolves the shortcut to the Fight AI logo rather than the generic `.cmd` icon.
- Daily launcher: `ABRIR_FIGHT_AI.cmd`.
- PC URL: `http://localhost:8787`.
- LAN URL used for phone testing: `http://192.168.4.81:8787` (the PC and phone must be on the same network; the LAN IP can change after reconnecting).
- External supervised beta: run `COMPARTIR_FIGHT_AI.cmd` to create a temporary authenticated HTTPS Cloudflare Tunnel without opening router ports. Use `VER_ACCESO_EXTERNO.cmd` to display the current URL and credentials locally. The free proxy path is limited to videos below 100 MB.

## Verification gate

- TypeScript: PASS.
- Next.js production build: PASS.
- Playwright desktop/mobile virtual agents: 16 passed, 2 device-specific skips.
- Real HEVC upload, mandatory frame marking, dual visual identity references, red-fighter identity, 01:28 attribution, report generation and JPEG evidence: PASS.

## Graphify continuity

`docs/GRAPIFY_BETA_SPEC.md` is the maintained graph-ready product/architecture source and now includes the strict target-identity contract and boxing-program catalog. Local Graphify extraction is not claimed as generated because the installed CLI requires a supported provider key (`MOONSHOT_API_KEY` or `ANTHROPIC_API_KEY`) that is not configured; the Markdown source remains complete for Graphify, OpenCode, Google AI Studio, Claude or another coding agent.
