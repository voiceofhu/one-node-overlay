import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OverlayConfig } from '../src/lib/config';
import type { Env } from '../worker/env';
import { renderSubscription } from '../worker/subscription';

const config: OverlayConfig = {
  sourceUrl: 'https://node.example.com/api/v1/one/sub/token',
  overlay: {
    outbounds: [
      { type: 'vless', tag: '自建节点' },
      { type: 'selector', tag: '节点选择', outbounds: ['自建节点'] },
    ],
    route: {
      rules: [{ action: 'route', outbound: '自建节点', domain_suffix: ['openai.com'] }],
    },
  },
};

const source = {
  outbounds: [
    { type: 'selector', tag: '节点选择', outbounds: ['订阅节点', 'direct'] },
    { type: 'vless', tag: '订阅节点' },
    { type: 'direct', tag: 'direct' },
  ],
  route: {
    rules: [{ action: 'sniff' }, { action: 'route', outbound: 'direct' }],
    final: '节点选择',
  },
};

describe('renderSubscription', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards device identity and returns a no-store merged profile', async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) =>
      new Response(JSON.stringify(source), {
        headers: {
          'X-One-Node-Output': 'singbox',
          'Profile-Title': 'base64:VGVzdA==',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await renderSubscription(
      new Request('https://overlay.example.com/sub/public', {
        headers: {
          'User-Agent': 'SFM (sing-box 1.14.0; language zh_CN)',
          'X-Device-OS': 'macOS',
        },
      }),
      {} as Env,
      config,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toBeDefined();
    expect((init!.headers as Headers).get('X-Device-OS')).toBe('macOS');

    const body = (await response.json()) as typeof source;
    expect(body.outbounds.at(-1)).toMatchObject({ tag: '自建节点' });
    expect(body.route.rules[1]).toMatchObject({ outbound: '自建节点' });
  });

  it('rejects an upstream format negotiated for another client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('base64-content', {
          headers: { 'X-One-Node-Output': 'base64' },
        }),
      ),
    );
    await expect(
      renderSubscription(
        new Request('https://overlay.example.com/sub/public'),
        {} as Env,
        config,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
