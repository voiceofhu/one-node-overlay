import { describe, expect, it } from 'vitest';

import type { Env } from '../worker/env';
import worker from '../worker/index';

function debugEnv(): Env {
  const values = new Map<string, string>();
  return {
    OVERLAY_CONFIG: {
      get: async (key: string) => values.get(key) ?? null,
      put: async (key: string, value: string) => {
        values.set(key, value);
      },
    } as unknown as KVNamespace,
  } as Env;
}

async function invoke(request: Request, env = debugEnv()): Promise<Response> {
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], env);
}

describe('request inspection route', () => {
  it('echoes method, repeated query parameters, headers, and JSON body', async () => {
    const env = debugEnv();
    const response = await invoke(
      new Request('https://overlay.example.com/debug/request?name=one&tag=a&tag=b', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer debug-token',
          'Content-Type': 'application/json',
          'X-Debug-Value': 'visible',
        },
        body: JSON.stringify({ hello: 'world' }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      request: {
        method: 'POST',
        pathname: '/debug/request',
        query: { name: 'one', tag: ['a', 'b'] },
        headers: {
          authorization: 'Bearer debug-token',
          'x-debug-value': 'visible',
        },
        body: { hello: 'world' },
      },
    });

    const viewer = await invoke(new Request('https://overlay.example.com/debug'), env);
    expect(viewer.headers.get('Content-Type')).toContain('text/html');
    await expect(viewer.text()).resolves.toContain('Bearer debug-token');
  });

  it('accepts methods without a request body', async () => {
    const response = await invoke(
      new Request('https://overlay.example.com/debug/request', { method: 'DELETE' }),
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      request: { method: 'DELETE', body: null },
    });
  });

  it('keeps only the latest 100 requests and renders collapsible entries', async () => {
    const env = debugEnv();
    for (let sequence = 0; sequence <= 100; sequence += 1) {
      await invoke(
        new Request(
          `https://overlay.example.com/debug/request?sequence=${sequence}`,
        ),
        env,
      );
    }

    const viewer = await invoke(
      new Request('https://overlay.example.com/debug'),
      env,
    );
    const html = await viewer.text();
    expect(html).toContain('当前 100 条');
    expect(html).toContain('<details open>');
    expect(html).toContain('sequence=100');
    expect(html).not.toContain('?sequence=0"');
  });
});
