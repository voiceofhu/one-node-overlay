import type { Env } from './env';

const requestHistoryKey = 'debug:request-history';
const debugTTLSeconds = 24 * 60 * 60;
const maximumRequestHistory = 100;

interface RequestSnapshot {
  id: string;
  receivedAt: string;
  method: string;
  url: string;
  origin: string;
  pathname: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  cf: Request['cf'] | null;
  body: unknown;
}

function queryParameters(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams) {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }
  return result;
}

function redactedSubscriptionPath(pathname: string): string {
  return pathname.startsWith('/sub/') ? '/sub/[redacted]' : pathname;
}

function inspectedHeaders(headers: Headers): Record<string, string> {
  const result = Object.fromEntries(headers.entries());
  for (const name of ['authorization', 'cookie']) {
    if (result[name]) result[name] = '[redacted]';
  }
  return result;
}

async function requestBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD' || request.body === null) {
    return null;
  }
  const text = await request.text();
  const contentType = request.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return queryParameters(new URL(`https://debug.invalid/?${text}`));
  }
  return text;
}

function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function parseRequestHistory(value: string | null): RequestSnapshot[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as RequestSnapshot[];
    if (parsed && typeof parsed === 'object') {
      const legacy = parsed as Omit<RequestSnapshot, 'id'>;
      return [{ ...legacy, id: crypto.randomUUID() }];
    }
  } catch {
    // Ignore an invalid debug value and start a new history.
  }
  return [];
}

function requestDetails(snapshot: RequestSnapshot, index: number): string {
  const summary = escapeHTML(
    `${snapshot.method} ${snapshot.pathname} · ${snapshot.receivedAt}`,
  );
  const content = escapeHTML(JSON.stringify(snapshot, null, 2));
  return `<details${index === 0 ? ' open' : ''}>
    <summary>${summary}</summary>
    <pre>${content}</pre>
  </details>`;
}

export async function recordSubscriptionRequest(request: Request, env: Env): Promise<void> {
  const url = new URL(request.url);
  const pathname = redactedSubscriptionPath(url.pathname);
  const snapshot: RequestSnapshot = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    method: request.method,
    url: `${url.origin}${pathname}${url.search}`,
    origin: url.origin,
    pathname,
    query: queryParameters(url),
    headers: inspectedHeaders(request.headers),
    cf: request.cf ?? null,
    body: await requestBody(request),
  };
  const history = parseRequestHistory(
    await env.OVERLAY_CONFIG.get(requestHistoryKey),
  );
  history.unshift(snapshot);
  await env.OVERLAY_CONFIG.put(
    requestHistoryKey,
    JSON.stringify(history.slice(0, maximumRequestHistory)),
    {
      expirationTtl: debugTTLSeconds,
    },
  );
}

export async function showRequestInspection(env: Env): Promise<Response> {
  const history = parseRequestHistory(
    await env.OVERLAY_CONFIG.get(requestHistoryKey),
  );
  const content =
    history.length > 0
      ? history.map(requestDetails).join('\n')
      : '<p>还没有收到调试请求。</p>';
  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Overlay 请求调试</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    body { margin: 0; padding: 24px; background: Canvas; color: CanvasText; }
    header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    h1 { margin: 0; font: 600 20px/1.4 system-ui, sans-serif; }
    span { color: GrayText; font: 13px/1.4 system-ui, sans-serif; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; }
    button { padding: 7px 12px; border: 1px solid GrayText; border-radius: 8px; background: Canvas; color: CanvasText; cursor: pointer; }
    main { display: flex; flex-direction: column; gap: 10px; }
    details { overflow: hidden; border: 1px solid GrayText; border-radius: 10px; }
    summary { padding: 12px 14px; cursor: pointer; font-weight: 600; }
    pre { margin: 0; padding: 14px; overflow: auto; border-top: 1px solid GrayText; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <header>
    <div><h1>最近 100 次请求</h1><span>当前 ${history.length} 条 · 保存 24 小时</span></div>
    <nav>
      <button type="button" onclick="document.querySelectorAll('details').forEach((item) => item.open = true)">全部展开</button>
      <button type="button" onclick="document.querySelectorAll('details').forEach((item) => item.open = false)">全部收起</button>
      <button type="button" onclick="location.reload()">刷新</button>
    </nav>
  </header>
  <main>${content}</main>
</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
