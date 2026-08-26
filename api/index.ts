import { handler } from '../backend/index';

export default async function api(request: any, response: any): Promise<void> {
  const result = await handler(request);
  response.status(result.status).json(result.body);
}