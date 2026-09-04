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
  it('records subscription requests before handling and redacts credentials', async () => {
    const env = debugEnv();
    const response = await invoke(
      new Request('https://overlay.example.com/sub/private-id?name=one&tag=a&tag=b', {
        headers: {
          Authorization: 'Bearer debug-token',
          Cookie: 'session=private',
          'X-Debug-Value': 'visible',
        },
      }),
      env,
    );

    expect(response.status).toBe(404);

    const viewer = await invoke(new Request('https://overlay.example.com/debug'), env);
    expect(viewer.headers.get('Content-Type')).toContain('text/html');
    const html = await viewer.text();
    expect(html).toContain('/sub/[redacted]');
    expect(html).toContain('x-debug-value');
    expect(html).toContain('"tag": [');
    expect(html).toContain('"authorization": "[redacted]"');
    expect(html).toContain('"cookie": "[redacted]"');
    expect(html).not.toContain('private-id');
    expect(html).not.toContain('debug-token');
    expect(html).not.toContain('session=private');
  });

  it('does not expose the old debug request collector', async () => {
    const response = await invoke(new Request('https://overlay.example.com/debug/request'));
    expect(response.status).toBe(404);
  });

  it('keeps only the latest 100 requests and renders collapsible entries', async () => {
    const env = debugEnv();
    for (let sequence = 0; sequence <= 100; sequence += 1) {
      await invoke(
        new Request(
          `https://overlay.example.com/sub/request-${sequence}?sequence=${sequence}`,
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
