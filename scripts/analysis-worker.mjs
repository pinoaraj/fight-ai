const port = process.env.PORT || '3000';
const endpoint = `http://127.0.0.1:${port}/api/analyze-uploaded?worker=1`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A dedicated process owns the long request.  The web server only enqueues jobs,
// so an HTTP response, CloudFront connection, or page refresh cannot stop Gemini.
for (;;) {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) console.error(`Fight AI worker request failed: ${response.status}`);
    await pause(response.ok ? 1500 : 5000);
  } catch {
    // Next may still be booting, or it may be restarting after a deployment.
    await pause(3000);
  }
}
