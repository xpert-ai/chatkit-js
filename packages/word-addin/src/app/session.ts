export type ChatKitSession = {
  client_secret: string;
  expires_at?: string;
  expires_after?: number;
  apiUrl: string;
  frameUrl: string;
  xpertId: string;
  organizationId?: string | null;
};

const SESSION_ENDPOINT =
  (import.meta.env.VITE_CHATKIT_SESSION_URL as string | undefined) ??
  '/api/create-session';

export async function createChatKitSession(
  currentClientSecret?: string | null,
): Promise<ChatKitSession> {
  const response = await fetch(SESSION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(
      currentClientSecret ? { currentClientSecret } : {},
    ),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<
    ChatKitSession & { error: string }
  >;

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  if (!payload.client_secret || !payload.apiUrl || !payload.frameUrl || !payload.xpertId) {
    throw new Error('ChatKit session response is missing required fields.');
  }

  return payload as ChatKitSession;
}
