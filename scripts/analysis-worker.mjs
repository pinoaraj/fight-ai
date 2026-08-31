import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
const port = process.env.PORT || '3000';
const table = process.env.FIGHT_AI_JOBS_TABLE;
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION || 'sa-east-1' });
const owner = crypto.randomUUID();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A dedicated process owns the long request.  The web server only enqueues jobs,
// so an HTTP response, CloudFront connection, or page refresh cannot stop Gemini.
for (;;) {
  try {
    if (!table) { await pause(5000); continue; }
    const now = Date.now(); const stale = now - 120000;
    const values = { ':now': { N: String(now) }, ':stale': { N: String(stale) }, ':owner': { S: owner }, ':lease': { N: String(now + 720000) }, ':q': { S: 'queued' }, ':d': { S: 'downloading' }, ':c': { S: 'converting' }, ':u': { S: 'uploading' }, ':p': { S: 'preparing' }, ':g': { S: 'coaching' } };
    const names = { '#status': 'status' };
    const found = await dynamo.send(new ScanCommand({ TableName: table, FilterExpression: '#status IN (:q,:d,:c,:u,:p,:g) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now OR updatedAt < :stale)', ExpressionAttributeNames: names, ExpressionAttributeValues: values }));
    // Prefer the newest request so an old abandoned smoke test never blocks a
    // coach who just uploaded a sparring round.
    const id = found.Items
      ?.filter((item) => item.jobId?.S)
      .sort((a, b) => Number(b.updatedAt?.N || 0) - Number(a.updatedAt?.N || 0))[0]
      ?.jobId?.S;
    if (!id) { await pause(1500); continue; }
    await dynamo.send(new UpdateItemCommand({ TableName: table, Key: { jobId: { S: id } }, UpdateExpression: 'SET leaseOwner = :owner, leaseExpiresAt = :lease, updatedAt = :now', ConditionExpression: '#status IN (:q,:d,:c,:u,:p,:g) AND (attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now OR updatedAt < :stale)', ExpressionAttributeNames: names, ExpressionAttributeValues: values }));
    const heart = setInterval(() => { const tick = Date.now(); void dynamo.send(new UpdateItemCommand({ TableName: table, Key: { jobId: { S: id } }, UpdateExpression: 'SET updatedAt = :now, leaseExpiresAt = :lease', ConditionExpression: 'leaseOwner = :owner', ExpressionAttributeValues: { ':now': { N: String(tick) }, ':lease': { N: String(tick + 720000) }, ':owner': { S: owner } } })).catch(() => {}); }, 20000);
    const response = await fetch(`http://127.0.0.1:${port}/api/analyze-uploaded?workerJob=${encodeURIComponent(id)}&workerOwner=${encodeURIComponent(owner)}`);
    clearInterval(heart);
    if (!response.ok) console.error(`Fight AI worker request failed: ${response.status}`);
    await pause(response.ok ? 1500 : 5000);
  } catch {
    // Next may still be booting, or it may be restarting after a deployment.
    await pause(3000);
  }
}
