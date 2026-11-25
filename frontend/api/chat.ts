import { createAgentUIStreamResponse } from 'ai';
import { createPosAgent, type PosAgentUIMessage } from './_posAgent.ts';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return new Response(
      JSON.stringify({
        error:
          'Missing AI_GATEWAY_API_KEY. Add AI_GATEWAY_API_KEY to frontend/.env.local (or deploy on Vercel with AI Gateway OIDC enabled).',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messages } = (await request.json()) as { messages: PosAgentUIMessage[] };

  const authHeader = request.headers.get('authorization') ?? '';
  const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const locationId = request.headers.get('x-location-id') ?? undefined;
  const apiBaseUrl =
    process.env.POS_API_URL || process.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  const modelId = process.env.AI_MODEL || 'google/gemini-3.8-flash';

  const agent = createPosAgent({ authToken, locationId, apiBaseUrl, modelId });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
