import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

function loadEnv(): void {
  try {
    const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // Environment variables may be supplied by the hosting platform.
  }
}

loadEnv();
const { handler } = await import('./index');
const port = Number(process.env.API_PORT || 8788);

const server = createServer(async (request, response) => {
  const result = await handler(request);
  response.writeHead(result.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(result.body));
});

server.on('error', (cause) => {
  if ((cause as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.log(`Neon API is already running on http://localhost:${port}`);
    return;
  }
  console.error(`Neon API could not listen on port ${port}.`, cause);
  process.exitCode = 1;
});
server.listen(port, () => console.log(`Neon API listening on http://localhost:${port}`));
