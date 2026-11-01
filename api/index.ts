export default async function api(request: any, response: any): Promise<void> {
  try {
    const { handler } = await import('../backend/index');
    const result = await handler(request);
    response.status(result.status).json(result.body);
  } catch (cause) {
    console.error('API function failed to initialize or handle the request.', cause);
    const code = cause && typeof cause === 'object' && 'code' in cause
      ? String((cause as { code: unknown }).code)
      : '';
    const message = cause instanceof Error && cause.message === 'DATABASE_URL is required to connect to Neon.'
      ? 'API server is not configured. Set DATABASE_URL in the Vercel project environment.'
      : code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND'
        ? 'The API backend could not load in this deployment. Check the Vercel build and function logs.'
        : 'The API backend failed to initialize. Check DATABASE_URL and the Vercel function logs.';
    response.status(500).json({ error: message });
  }
}