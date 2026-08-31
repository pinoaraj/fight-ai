/**
 * Runs once when the long-lived Next.js server starts in ECS.
 * Route handlers only enqueue/poll; this process owns durable video jobs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  await import('./app/api/analyze-uploaded/route');
  (globalThis as typeof globalThis & { __fightAiStartDurableWorker?: () => void }).__fightAiStartDurableWorker?.();
}
