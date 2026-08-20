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
    const bodyText = await new Promise<string>((resolve, reject) => {
      let value = '';
      request.on('data', (chunk) => { value += chunk; });
      request.on('end', () => resolve(value));
      request.on('error', reject);
    });
    let body: unknown = {};
    if (bodyText) {
      try { body = JSON.parse(bodyText); } catch { return error('Request body must be valid JSON.', 400); }
    }
    const query = Object.fromEntries(url.searchParams.entries());
    const context = { body, query, params };
    try {
      return await route[1][0](context);
    } catch (cause) {
      console.error('API request failed', cause);
      return error('Internal server error.', 500);
    }
  };
}
