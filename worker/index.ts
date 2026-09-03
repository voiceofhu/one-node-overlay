import { formatZodError, overlayConfigSchema } from '../src/lib/config';
import { isEditorUUID } from '../src/lib/editor-path';
import { requireEditorKey } from './auth';
import { initialConfig, readConfig, writeConfig } from './config-store';
import type { Env } from './env';
import { errorResponse, HttpError, jsonResponse } from './errors';
import { renderSubscription } from './subscription';
import { inspectRequest, showRequestInspection } from './request-inspection';

const maximumConfigBytes = 512_000;

function subscriptionURL(request: Request, token: string): string {
  const url = new URL(request.url);
  return `${url.origin}/sub/${encodeURIComponent(token)}`;
}

async function getConfig(request: Request, env: Env): Promise<Response> {
  const editorKey = requireEditorKey(request);
  const storedConfig = await readConfig(env, editorKey);
  return jsonResponse({
    configured: storedConfig !== null,
    config: storedConfig ?? initialConfig(),
    subscriptionUrl: subscriptionURL(request, editorKey),
  });
}

async function putConfig(request: Request, env: Env): Promise<Response> {
  const editorKey = requireEditorKey(request);
  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > maximumConfigBytes) {
    throw new HttpError(413, '配置超过 500 KB 限制');
  }
  const body = await request.text();
  if (body.length > maximumConfigBytes) {
    throw new HttpError(413, '配置超过 500 KB 限制');
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new HttpError(400, '请求正文不是有效 JSON');
  }
  const parsed = overlayConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }
  if (parsed.data.sourceUrl === '') {
    throw new HttpError(400, '请输入原始订阅 URL');
  }
  await writeConfig(env, editorKey, parsed.data);
  return jsonResponse({
    configured: true,
    config: parsed.data,
    subscriptionUrl: subscriptionURL(request, editorKey),
  });
}

async function handleSubscription(request: Request, env: Env, pathToken: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new HttpError(405, '订阅接口只支持 GET 和 HEAD');
  }
  if (!isEditorUUID(pathToken)) {
    throw new HttpError(404, '订阅链接不存在');
  }
  const config = await readConfig(env, pathToken.toLowerCase());
  if (!config) {
    throw new HttpError(503, 'Overlay 尚未配置');
  }
  return renderSubscription(request, env, config);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/debug' && request.method === 'GET') {
        return await showRequestInspection(env);
      }
      if (url.pathname === '/debug/request') {
        return await inspectRequest(request, env);
      }
      if (url.pathname === '/api/config') {
        if (request.method === 'GET') return await getConfig(request, env);
        if (request.method === 'PUT') return await putConfig(request, env);
        throw new HttpError(405, '配置接口只支持 GET 和 PUT');
      }
      if (url.pathname.startsWith('/sub/')) {
        const pathToken = decodeURIComponent(url.pathname.slice('/sub/'.length));
        return await handleSubscription(request, env, pathToken);
      }
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  },
} satisfies ExportedHandler<Env>;
