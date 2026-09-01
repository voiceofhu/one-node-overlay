import { describe, expect, it } from 'vitest';

import type { OverlayConfig } from '../src/lib/config';
import { HttpError } from '../worker/errors';
import { mergeSubscription } from '../worker/merge';

const baseConfiguration = {
  outbounds: [
    {
      type: 'selector',
      tag: '节点选择',
      outbounds: ['自动选择', '订阅节点', 'direct'],
    },
    { type: 'urltest', tag: '自动选择', outbounds: ['订阅节点'] },
    { type: 'vless', tag: '订阅节点', server: 'source.example.com' },
    { type: 'direct', tag: 'direct' },
  ],
  route: {
    rules: [
      { action: 'sniff' },
      { action: 'hijack-dns', protocol: 'dns' },
      { action: 'route', outbound: 'direct', ip_is_private: true },
    ],
    final: '节点选择',
  },
  dns: { rules: [{ domain_suffix: ['cn'], action: 'route', server: 'local' }] },
};

const config: OverlayConfig = {
  sourceUrl: 'https://example.com/sub/token',
  overlay: {
    outbounds: [
      { type: 'vless', tag: '自建节点', server: 'own.example.com' },
      { type: 'selector', tag: '节点选择', outbounds: ['自建节点'] },
      { tag: '订阅节点', server: 'override.example.com' },
    ],
    route: {
      final: '自建节点',
      rules: [{ domain_suffix: ['openai.com'], action: 'route', outbound: '自建节点' }],
    },
    dns: {
      rules: [{ domain_suffix: ['openai.com'], action: 'route', server: 'remote' }],
    },
  },
};

describe('mergeSubscription', () => {
  it('gives tagged user objects and scalar fields precedence', () => {
    const merged = mergeSubscription(baseConfiguration, config);
    const outbounds = merged.outbounds as Array<Record<string, unknown>>;
    expect(outbounds[0].outbounds).toEqual([
      '自建节点',
      '自动选择',
      '订阅节点',
      'direct',
    ]);
    expect(outbounds[2]).toMatchObject({
      tag: '订阅节点',
      type: 'vless',
      server: 'override.example.com',
    });
    expect(outbounds.at(-1)).toMatchObject({ tag: '自建节点' });
    expect((merged.route as Record<string, unknown>).final).toBe('自建节点');
  });

  it('keeps routing prerequisites first, then places user rules before source routes', () => {
    const merged = mergeSubscription(baseConfiguration, config);
    const route = merged.route as { rules: Array<Record<string, unknown>> };
    expect(route.rules[0]).toMatchObject({ action: 'sniff' });
    expect(route.rules[1]).toMatchObject({ action: 'hijack-dns' });
    expect(route.rules[2]).toMatchObject({ outbound: '自建节点' });
    expect(route.rules[3]).toMatchObject({ outbound: 'direct' });

    const dns = merged.dns as { rules: Array<Record<string, unknown>> };
    expect(dns.rules[0]).toMatchObject({ server: 'remote' });
    expect(dns.rules[1]).toMatchObject({ server: 'local' });
  });

  it('does not mutate source or user JSON', () => {
    const sourceBefore = structuredClone(baseConfiguration);
    const configBefore = structuredClone(config);
    mergeSubscription(baseConfiguration, config);
    expect(baseConfiguration).toEqual(sourceBefore);
    expect(config).toEqual(configBefore);
  });

  it('rejects a non-object upstream document', () => {
    expect(() => mergeSubscription([], config)).toThrow(HttpError);
  });
});
