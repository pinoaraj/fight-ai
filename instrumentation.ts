// The durable worker is a sibling process started by the container entrypoint.
// Keeping it outside the request server prevents Next.js from discarding long
// analyses after the 202 enqueue response has been sent.
export async function register() {}
