import type { OverlayConfig } from '../src/lib/config';
import type { Env } from './env';
import { HttpError } from './errors';
import { mergeSubscription } from './merge';

const forwardedHeaders = [
  'Accept',
  'User-Agent',
  'X-Device-OS',
  'X-Ver-OS',
  'X-Device-Model',
] as const;

const returnedHeaders = [
  'Profile-Title',
  'S-Title',
  'Subscription-Name',
  'Profile-Web-Page-URL',
  'Subscription-Userinfo',
  'Profile-Update-Interval',
] as const;

function upstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Overlay-Output': 'singbox',
  });
  for (const name of returnedHeaders) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function fetchSource(request: Request, config: OverlayConfig): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(config.sourceUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders(request),
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(502, '无法连接上游订阅');
  }
  if (!response.ok) {
    throw new HttpError(502, `上游订阅返回 HTTP ${response.status}`);
  }
  if (response.headers.get('X-One-Node-Output') !== 'singbox') {
    throw new HttpError(400, '该订阅链接只支持 sing-box 客户端');
  }
  return response;
}

export async function renderSubscription(
  request: Request,
  env: Env,
  config: OverlayConfig,
): Promise<Response> {
  const upstream = await fetchSource(request, config);
  const headers = responseHeaders(upstream);
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  const contentLength = Number(upstream.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
    throw new HttpError(502, '上游订阅超过 2 MB 限制');
  }
  const sourceText = await upstream.text();
  if (sourceText.length > 2_000_000) {
    throw new HttpError(502, '上游订阅超过 2 MB 限制');
  }

  let sourceDocument: unknown;
  try {
    sourceDocument = JSON.parse(sourceText);
  } catch {
    throw new HttpError(502, '上游返回的 sing-box 配置不是有效 JSON');
  }
  const merged = mergeSubscription(sourceDocument, config);
  return new Response(JSON.stringify(merged, null, 2), {
    status: 200,
    headers,
  });
}
