import { handler } from '../backend/index';

export default async function api(request: any, response: any): Promise<void> {
  try {
    const result = await handler(request);
    response.status(result.status).json(result.body);
  } catch (cause) {
    console.error('API function failed to initialize or handle the request.', cause);
    const message = cause instanceof Error && cause.message === 'DATABASE_URL is required to connect to Neon.'
      ? 'API server is not configured. Set DATABASE_URL in the Vercel project environment.'
      : 'The API request failed. Check the database configuration and Vercel function logs.';
    response.status(500).json({ error: message });
  }
}