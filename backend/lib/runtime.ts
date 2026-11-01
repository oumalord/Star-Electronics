import type { IncomingMessage } from 'node:http';

type RouteContext = {
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
};
type RouteResponse = { status: number; body: unknown };
type RouteHandler = (ctx: RouteContext) => Promise<RouteResponse> | RouteResponse;

type RouteMap = Record<string, RouteHandler[]>;

export type RouterContext = RouteContext;

export function json(body: unknown, status = 200): RouteResponse {
  return { status, body };
}

export function error(message: string, status = 400): RouteResponse {
  return { status, body: { error: message } };
}

function requestFailure(cause: unknown): RouteResponse {
  const message = cause instanceof Error ? cause.message : '';
  const code = cause && typeof cause === 'object' && 'code' in cause
    ? String((cause as { code: unknown }).code)
    : '';
  if (code === '42P01' || /relation .+ does not exist/i.test(message)) {
    return error('The database schema is missing. Run backend/schema.sql against the configured database.', 503);
  }
  if (message.includes('DATABASE_URL')) {
    return error('The API database is not configured. Set DATABASE_URL in the deployment environment.', 503);
  }
  console.error('API request failed', cause);
  const safeCode = /^[A-Z0-9_]{1,16}$/i.test(code) ? code : undefined;
  const failureType = cause instanceof Error && /^[A-Z][A-Za-z0-9]{0,40}$/.test(cause.name)
    ? cause.name
    : undefined;
  return {
    status: 500,
    body: {
      error: 'The API request failed. Check the database configuration and server logs.',
      ...(safeCode ? { code: safeCode } : {}),
      ...(failureType ? { failureType } : {}),
    },
  };
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index].startsWith(':')) params[expected[index].slice(1)] = decodeURIComponent(actual[index]);
    else if (expected[index] !== actual[index]) return null;
  }
  return params;
}

export function router(routes: RouteMap) {
  return async (request: IncomingMessage): Promise<RouteResponse> => {
    const url = new URL(request.url || '/', 'http://localhost');
    const route = Object.entries(routes).find(([key]) => {
      const [method, ...pathParts] = key.split(' ');
      return method === request.method && matchPath(pathParts.join(' '), url.pathname);
    });
    if (!route) return error('Route not found.', 404);

    const [, ...pathParts] = route[0].split(' ');
    const params = matchPath(pathParts.join(' '), url.pathname) || {};
    const parsedRequest = request as IncomingMessage & { body?: unknown };
    let body: unknown = parsedRequest.body ?? {};
    const method = request.method?.toUpperCase();
    const mayHaveBody = method !== 'GET' && method !== 'HEAD';
    if (parsedRequest.body === undefined && mayHaveBody && !request.readableEnded) {
      const bodyText = await new Promise<string>((resolve, reject) => {
        let value = '';
        request.on('data', (chunk) => { value += chunk; });
        request.on('end', () => resolve(value));
        request.on('error', reject);
      });
      if (bodyText) {
        try { body = JSON.parse(bodyText); } catch { return error('Request body must be valid JSON.', 400); }
      }
    }
    const query = Object.fromEntries(url.searchParams.entries());
    const context = { body, query, params };
    try {
      return await route[1][0](context);
    } catch (cause) {
      return requestFailure(cause);
    }
  };
}
