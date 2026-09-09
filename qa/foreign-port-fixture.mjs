import http from 'node:http';

const port = Number(process.argv[2] || 8787);
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ service: 'foreign-medical-app', ok: true }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`foreign fixture listening on ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
