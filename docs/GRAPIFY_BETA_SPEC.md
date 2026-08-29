# Grapify / Fight AI — Living Product & Architecture Spec

_Last updated: 2026-08-29_

## 1. Product goal
Fight AI is a boxing/kickboxing sparring-analysis platform with mobile and web clients sharing one analysis contract. It must provide coach-style feedback grounded in visible video evidence, never invented strike counts or unsupported certainty.

### Core coaching premise — clinical eye, not generic commentary
Fight AI must analyze sparring as closely as possible to how an experienced combat-sports coach reviews a round. The engine should connect visible actions into recurring technical and tactical patterns, explain why those patterns matter in the matchup, identify what the opponent is exploiting or vulnerable to, and convert the highest-value findings into specific corrections, game-plan adjustments and drills.

Required reasoning chain:
- visible observation;
- recurring pattern vs one-off moment;
- likely technical/tactical cause when supported;
- consequence in the exchange/matchup;
- specific correction;
- drill prescription;
- timestamp evidence;
- visual teaching aid when useful.

Generic advice such as “keep your hands up” or “move your feet more” is insufficient unless tied to exact recurring context, consequence and correction.

## 2. Shared analysis contract
Every client consumes the same logical report schema:
- target fighter identity + confidence
- provider status and `usedInReport`
- summary / main takeaway
- strengths
- technical priorities
- opponent patterns
- tactical/rematch plan
- next-session goals
- drills
- timestamped evidence with observation and correction

Gemini may be credited only after an authenticated request succeeds and accepted evidence is present. CV/Pose and Video-AI sources must remain distinguishable.

## 3. Fighter identity
Target selection must be explicit and Android-like. The preferred web flow is:
1. upload/preview the video;
2. decode and seek to a non-zero visible frame automatically instead of presenting a black `00:00` selection surface;
3. let the athlete scrub/pause at any clearer moment;
4. visually circle/mark the fighter on that visible frame;
5. optionally adjust circle size;
6. provide visible descriptors such as glove color, clothing, relative height, build and free-form notes;
7. provide stance and discipline;
8. keep identity through temporal continuity and descriptors;
9. exclude low-confidence windows from evidence instead of silently switching fighters.

Marking mode must never darken or cover the video image. The click layer is transparent so the athlete sees the exact fighter being selected. The mark records both frame-relative coordinates and the video time used for the anchor.

The web must not enable marking merely from video metadata. It first confirms a decoded non-zero frame. If local browser decoding stalls (for example, a phone codec such as HEVC), it automatically generates a compatible selection frame: the server stages the upload only on ephemeral disk, uses FFmpeg to decode one JPEG, deletes the temporary file and returns that JPEG as the visual selection surface. The original video remains the analysis input and is still sent through the existing Gemini upload flow; the athlete is never asked to mark a black surface.

Web multipart identity fields now include:
- `athlete_marker`
- `glove_color`
- `top_color`
- `relative_height`
- `build`
- `fighter_notes`
- `anchor_x`
- `anchor_y`
- `anchor_size`
- `anchor_time`
- `stance`

## 4. Mobile baseline
Android remains the interaction source of truth for fighter selection, provider attribution, visual correction guidance and report semantics. Web should mirror Android intent while adapting controls for browser use.

## 5. Web product parity
Branch: `web/mvp`
PR: #2
Stack: Next.js 15.5.24 + React 19 + TypeScript.

### Current web analysis flow
The current upgraded web flow contains:
- responsive desktop/mobile workspace;
- upload + local preview with automatic seek to an early decoded non-zero frame;
- visual fighter circle/anchor on a visible paused video frame, with manual timeline scrubbing before selection;
- identity descriptors: glove color, clothing, height, build and free-form characteristics;
- discipline, stance and language;
- selectable virtual-coach focus areas: boxing technique, weaknesses, strategy, defense, offense, footwork, distance/timing plus custom focus text;
- visible elapsed analysis time and multi-stage analysis state;
- explicit Gemini/provider badge showing whether the provider participated in the current report;
- clinical report sections: diagnosis, strengths to preserve, top priorities, opponent reading, tactical plan and drills;
- Visual Coach correction panel;
- correction-video references for detected footwork/angle issues;
- timestamp evidence cards with frame captures generated from the uploaded video;
- evidence click-to-seek/playback;
- browser PDF/print export including evidence images;
- responsive mobile layout.

### Product acceptance criteria
Web is not release-ready unless:
- the local video actually decodes to a visible non-zero frame before visual fighter marking is enabled;
- marking mode preserves full frame visibility;
- selected fighter can be identified visually or with descriptors;
- analysis focus selections are sent to the engine and affect prompt context;
- report clearly states if Gemini participated;
- timestamps replay the local video;
- PDF contains report content and captured evidence images when frames are available;
- detected footwork/angle issues have useful visual/video correction references;
- report quality is specific enough to feel like a real coach review rather than generic advice;
- desktop and mobile virtual-agent tests pass.

## 6. Gemini / analysis quality contract
When the shared Fight AI backend is absent, the web server uses Gemini server-side. The browser never receives the Gemini key.

The direct Gemini path now requires a higher clinical-coaching standard. Prompt requirements include:
- identify only the selected fighter using anchor coordinates + anchor time + descriptors + temporal continuity;
- separate visible facts from tactical hypotheses;
- inspect guard recovery, balance/base, weight transfer, entries, exits, head movement, defense after combinations, range, timing, pivots/angles, footwork, punch selection, rhythm, pressure, reactions to the jab, body work and decision-making when visible;
- find recurring patterns across the video rather than isolated generic mistakes;
- explain what the opponent is exploiting and what can be exploited in return;
- return only the three highest-impact priorities;
- make strengths strategically useful, not compliments;
- prescribe drills tied to each priority with practical structure;
- provide 4–8 timestamp evidence moments when the footage supports them;
- produce a 4–7 sentence diagnostic summary containing style, main limiting pattern, opponent exploitation, useful strength and the #1 next-session change;
- forbid invented exact punch counts, percentages or unsupported statistics.

## 7. Video speed / large-file path
A key user-facing problem is analysis latency on real sparring files. The deployed beta path separates browser upload from the analysis request: the browser streams the video body to `/api/upload`, the server forwards that stream to Gemini's resumable upload endpoint without first materializing a second full `video.arrayBuffer()`, then `/api/analyze-uploaded` analyzes the returned Gemini file reference. This reduces memory pressure/copy overhead and avoids resending the same video bytes with the analysis request.

Gemini file preparation polling allows up to 8 minutes for large files. The UI displays elapsed time and progressive stages such as upload/preparation, fighter identification, pattern reading, opponent/strategy analysis and report construction instead of appearing frozen.

Production verification on 2026-08-29 exercised the browser-equivalent path against the public AWS beta: `/api/health` returned `analysisReady: true` and `geminiConfigured: true`; `/api/upload` returned a valid Gemini file reference; `/api/analyze-uploaded` returned a real Gemini report with `usedInReport: true`, non-empty priorities and four timestamp evidence items. This materially fixes the previous long-video request/memory path for the beta.

This is still not the final durable asynchronous architecture. A future production hardening phase should move ingestion and analysis behind private persistent jobs/queue storage, with resumable client job IDs, retries and progress surviving page reloads or worker restarts. Do not describe the current beta as a fully persistent asynchronous job system.

## 8. Evidence and PDF
Timestamp evidence must be reproducible against the same uploaded local video. Clicking evidence seeks the preview to the parsed `MM:SS` time and attempts playback after the seek completes.

The web client captures up to four evidence frames locally from the uploaded video using a hidden video/canvas pipeline. Those frames are displayed beside timestamp findings and are included by the print stylesheet when exporting/saving the report as PDF.

If a timestamp has no verifiable frame or the browser cannot decode it, the product should show a placeholder rather than fabricate an image.

## 9. Visual coaching
Detected mistakes should link to teaching aids tied to the issue. Current web beta includes:
- simplified entry/base/angle diagrams that remain visible in the printable/PDF report;
- a bundled demonstration sparring clip for reproducible demo evidence;
- correction-video embeds/references for footwork, pivot and angle topics when the report contains related priorities.

Long-term direction remains short mistake-specific motion demos, trajectory graphics and simplified animations matched to the athlete's detected error.

## 10. QA matrix
Required combined web gate:
- TypeScript
- Next.js production build
- shared-backend adapter/runtime QA
- Playwright virtual web agents on desktop and Pixel-class mobile viewport
- real MP4 decode + non-zero preview frame assertion
- fighter-circle click on the decoded frame
- Docker production build
- AWS OIDC
- ECR push
- ALB/ECS deployment
- `/api/health`
- real deployed Gemini smoke
- browser-equivalent `/api/upload` -> `/api/analyze-uploaded` streaming smoke
- provider attribution (`Gemini` + `usedInReport: true`)
- fighter identity controls
- coach-focus controls
- processing state
- evidence count/playback UI
- PDF action
- visual-coach correction content
- mobile horizontal-overflow check

### Virtual web-agent gate
The updated Playwright agent covers:
- demo report and truthful provider state;
- upload/preview;
- decoding the real regression MP4 to `readyState >= 2`, non-zero video dimensions and a non-zero selected preview time;
- visual fighter marking on the decoded frame;
- fighter descriptor input;
- coach focus selection including footwork;
- sport/stance selection;
- live multipart analysis against deterministic mock backend;
- staged processing state;
- report rendering;
- provider attribution;
- evidence cards and uploaded-video evidence seek/render behavior;
- correction-video/demo-video section;
- printable diagrams and PDF action;
- mobile responsive layout.

A build is not release-ready if this gate fails. A fake byte buffer that merely creates a `<video>` element is not considered a valid preview test.

## 11. AWS beta architecture
Current production path:
- private ECR `fight-ai-web`
- ECS Fargate
- internet-facing ALB
- container port 3000
- ALB HTTP 80 for beta
- `/api/health`
- GitHub Actions OIDC
- deployment role `FightAIGitHubDeployRole`
- task execution role `FightAIEcsTaskExecutionRole`
- cluster/service/task family `fight-ai-web`

Current public beta endpoint:
`http://fight-ai-web-alb-2053895073.sa-east-1.elb.amazonaws.com`

The repository uses a custom GitHub OIDC subject template; IAM trust is working and deployments authenticate through short-lived OIDC credentials.

Verified release deployment `b59668a4a54a1977d5b96369eed219265afbd25a` completed successfully through OIDC, ECR build/push, ALB/ECS registration/deployment and the public Gemini runtime verification. There are no application-runtime changes between that deployed commit and the current branch state at the time of this verification; subsequent commits only change QA/workflow/Codex documentation. The production streaming smoke checked out the later branch state and successfully exercised the deployed browser-equivalent upload/reference-analysis path.

## 12. Secret handling and security
- no Gemini key in browser/client source;
- no static AWS keys in repository;
- GitHub Actions uses OIDC;
- beta currently injects `GEMINI_API_KEY` server-side into ECS from the GitHub Actions secret because SSM/Secrets Manager are unavailable for this account;
- migrate to managed AWS secret storage when available;
- uploaded sparring should remain private by default;
- minimize retention;
- provider attribution must be truthful;
- no invented statistics.

## 13. Production hardening
- HTTPS + ACM + port 443 before general public release;
- asynchronous private large-video upload/job architecture with persistent queue/job IDs;
- persistent progress/retry state that survives page reloads and worker restarts;
- CloudWatch logs/metrics;
- shared CV/Pose backend via `FIGHT_AI_API_URL`;
- richer generated visual correction demos;
- session/history/progress surfaces aligned with Android.

## 14. Current release state
The 2026-08-29 web beta upgrade is **materially fixed, validated and deployed for the current direct/streaming long-video path**. Verified gates include:
1. Web MVP CI passes TypeScript, production build, shared-backend adapter/runtime QA, real-video decoded preview + fighter marking, desktop/mobile virtual agents and Docker production build;
2. AWS deployment `b59668a4a54a1977d5b96369eed219265afbd25a` succeeded through GitHub OIDC, ECR and ALB/ECS and passed public runtime verification;
3. public `/api/health` reports `analysisReady: true` and `geminiConfigured: true`;
4. the browser-equivalent streaming production smoke successfully ran `/api/upload` followed by `/api/analyze-uploaded` and produced a real Gemini report with `provider: Gemini`, `usedInReport: true`, priorities and four evidence items;
5. deployed application code contains visible-frame fighter anchor selection, fighter descriptors, coach-focus controls, staged progress, evidence replay/frame capture, PDF image support and visual correction content.

Remaining work is production hardening rather than a blocker for this beta: the current two-step streaming/reference flow still holds the analysis request open and does not yet provide durable asynchronous background jobs, persisted retry/progress state or reload-safe job IDs.
