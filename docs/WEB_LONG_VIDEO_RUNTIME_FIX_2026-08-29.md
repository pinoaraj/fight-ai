# Fight AI Web — long-video HTTP 502 production hardening

Date: 2026-08-29
Branch: `web/mvp`

## Incident
A real browser analysis on the public beta returned an upstream HTML HTTP 502 and the UI surfaced: “El servidor interrumpió el análisis”. The existing release smoke used a very small real sparring proof clip, so it proved Gemini attribution and end-to-end connectivity but did not exercise the long-running request/resource profile of a normal user recording.

## Most likely failure modes addressed
The public beta still performs direct Gemini fallback synchronously when `FIGHT_AI_API_URL` is not configured. In that path Next.js parses multipart video data and the process can hold significant memory while Gemini Files processing and coaching generation run. The previous AWS runtime used only 0.5 vCPU / 1 GiB and the ALB idle timeout was 300 seconds. Either a long Gemini round-trip reaching the ALB timeout or memory pressure could terminate the upstream connection as an HTML 502 before Next.js could return its JSON error.

## Runtime hardening deployed
Commit `beac9e8ef7b0fb8e1c23cb4bb7574606cc357fad` changed the AWS web runtime to:
- ALB idle timeout: 300 s → 1200 s;
- ECS Fargate task: 0.5 vCPU / 1 GiB → 1 vCPU / 3 GiB;
- Node heap ceiling: `--max-old-space-size=2304`;
- GitHub deploy job timeout: 35 min → 45 min;
- deployed Gemini smoke client timeout: 240 s → 600 s.

GitHub Actions run `33263019255` passed OIDC, ECR push, ALB provisioning, ECS service stabilization, public `/api/health`, and the real Gemini `/api/analyze` smoke after these changes.

## What this does and does not prove
This hardening removes the known 5-minute ALB ceiling and gives the synchronous beta path materially more headroom. The browser-facing uploaded-video route now additionally offers an asynchronous job wrapper: it returns a job ID, polls short status requests and keeps Gemini preparation/coaching off the CloudFront viewer request. This enables the HTTPS mobile entry point without CloudFront cutting a long POST response. It does **not** replace the planned durable production architecture: jobs are currently process-memory state and must move to private persistent ingestion, queue storage and reload-safe job IDs.

## Release/QA rule
Do not treat the tiny Gemini proof clip as sufficient evidence for large-video reliability. Before general public launch, add and pass a representative large sparring upload/report E2E regression, plus CloudWatch task/application diagnostics. If another real user upload returns an upstream 502 after this hardening, prioritize async ingestion/streaming upload rather than increasing timeouts or memory again.

## Per-run timing instrumentation

The web client records browser upload duration and original/processed byte counts for the direct Gemini flow. The streaming upload response records Gemini upload duration; `/api/analyze-uploaded` records Gemini file-preparation and coaching-generation durations. The completed report shows the relevant timing summary, using `no medido` rather than inventing a value for stages not yet implemented (preprocessing remains `0` and one original clip is used). These measurements establish the baseline for the next architectural step: candidate-moment detection and short original clips rather than raising timeouts again.
