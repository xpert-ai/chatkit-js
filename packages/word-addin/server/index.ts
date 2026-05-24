import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;

const SESSION_COOKIE_NAME = 'chatkit_word_session_id';
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_PORT = 8788;
const DEFAULT_XPERTAI_API_URL = 'https://api.mtda.cloud/api/ai';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = resolve(__dirname, '../..');
const taskpaneRoot = resolve(packageRoot, 'dist/taskpane');

function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (key.trim() && process.env[key.trim()] === undefined) {
      process.env[key.trim()] = value;
    }
  }
}

loadEnvFile(resolve(packageRoot, '.env'));
loadEnvFile(resolve(packageRoot, '.env.local'));

function getConfig() {
  return {
    port: Number(process.env.PORT ?? DEFAULT_PORT),
    apiUrl: stripTrailingSlash(process.env.XPERTAI_API_URL ?? DEFAULT_XPERTAI_API_URL),
    apiKey: process.env.XPERTAI_API_KEY,
    xpertId: process.env.XPERTAI_XPERT_ID,
    frameUrl: process.env.XPERTAI_CHATKIT_FRAME_URL ?? process.env.VITE_CHATKIT_FRAME_URL,
    organizationId: process.env.XPERTAI_ORGANIZATION_ID,
    principalUserId: process.env.XPERTAI_PRINCIPAL_USER_ID,
    expiresAfter: readPositiveInteger(process.env.XPERTAI_CLIENT_SECRET_EXPIRES_AFTER) ?? 600,
    allowedOrigin: process.env.CORS_ORIGIN ?? '*',
    serveStatic: process.env.SERVE_STATIC === 'true',
  };
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: JsonObject,
  cookieValue?: string,
): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cookieValue) {
    response.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=${cookieValue}; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax`,
    );
  }
  response.end(`${JSON.stringify(payload)}\n`);
}

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const config = getConfig();
  const origin =
    config.allowedOrigin === '*'
      ? request.headers.origin ?? '*'
      : config.allowedOrigin;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

async function readJsonBody(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

function readCookie(request: IncomingMessage, name: string): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }

  for (const segment of cookie.split(';')) {
    const [rawKey, ...rawValue] = segment.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
}

function resolveUserId(request: IncomingMessage): { userId: string; cookie?: string } {
  const existing = readCookie(request, SESSION_COOKIE_NAME);
  if (existing) {
    return { userId: existing };
  }

  const userId = crypto.randomUUID();
  return { userId, cookie: userId };
}

async function createSession(request: IncomingMessage, response: ServerResponse) {
  const config = getConfig();
  const body = await readJsonBody(request);
  const expiresAfter =
    readPositiveInteger(body.expires_after) ??
    readPositiveInteger(body.expiresAfter) ??
    config.expiresAfter;

  if (!config.apiKey) {
    sendJson(response, 500, { error: 'Missing XPERTAI_API_KEY environment variable.' });
    return;
  }
  if (!config.xpertId) {
    sendJson(response, 500, { error: 'Missing XPERTAI_XPERT_ID environment variable.' });
    return;
  }
  if (!config.frameUrl) {
    sendJson(response, 500, { error: 'Missing XPERTAI_CHATKIT_FRAME_URL environment variable.' });
    return;
  }

  const resolvedUser = resolveUserId(request);
  const principalUserId = config.principalUserId ?? resolvedUser.userId;

  const upstreamResponse = await fetch(`${config.apiUrl}/v1/chatkit/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      ...(config.organizationId ? { 'organization-id': config.organizationId } : {}),
      ...(principalUserId ? { 'x-principal-user-id': principalUserId } : {}),
    },
    body: JSON.stringify({
      expires_after: expiresAfter,
    }),
  });

  const payload = (await upstreamResponse.json().catch(() => ({}))) as JsonObject;
  if (!upstreamResponse.ok) {
    sendJson(
      response,
      upstreamResponse.status,
      {
        error:
          typeof payload.error === 'string'
            ? payload.error
            : upstreamResponse.statusText || 'Failed to create ChatKit session.',
      },
      resolvedUser.cookie,
    );
    return;
  }

  const clientSecret = payload.client_secret;
  if (typeof clientSecret !== 'string' || !clientSecret) {
    sendJson(
      response,
      502,
      { error: 'Missing client_secret in Xpert ChatKit session response.' },
      resolvedUser.cookie,
    );
    return;
  }

  sendJson(
    response,
    200,
    {
      client_secret: clientSecret,
      expires_at: payload.expires_at,
      expires_after: payload.expires_after ?? expiresAfter,
      apiUrl: config.apiUrl,
      frameUrl: config.frameUrl,
      xpertId: config.xpertId,
      organizationId: config.organizationId ?? null,
    },
    resolvedUser.cookie,
  );
}

function getContentType(path: string): string {
  switch (extname(path)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function serveStatic(request: IncomingMessage, response: ServerResponse): boolean {
  const config = getConfig();
  if (!config.serveStatic || !request.url) {
    return false;
  }

  const url = new URL(request.url, 'http://localhost');
  const pathname = url.pathname === '/' ? '/taskpane.html' : url.pathname;
  const target = resolve(join(taskpaneRoot, pathname));
  if (!target.startsWith(taskpaneRoot) || !existsSync(target) || !statSync(target).isFile()) {
    return false;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', getContentType(target));
  createReadStream(target).pipe(response);
  return true;
}

const server = createServer(async (request, response) => {
  applyCors(request, response);

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method === 'POST' && request.url?.startsWith('/api/create-session')) {
    try {
      await createSession(request, response);
    } catch (error) {
      sendJson(response, 502, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (request.method === 'GET' && serveStatic(request, response)) {
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

const config = getConfig();
server.listen(config.port, () => {
  console.log(`Word ChatKit session proxy listening on http://localhost:${config.port}`);
});
