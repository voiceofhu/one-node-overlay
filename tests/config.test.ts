import { describe, expect, it } from 'vitest';

import { emptyOverlayConfig, overlayConfigSchema } from '../src/lib/config';

describe('overlayConfigSchema', () => {
  it('uses empty source and user JSON for a new configuration', () => {
    expect(emptyOverlayConfig).toEqual({ sourceUrl: '', overlay: {} });
    expect(overlayConfigSchema.safeParse(emptyOverlayConfig).success).toBe(true);
  });

  it('accepts an HTTPS source and one user JSON object', () => {
    expect(
      overlayConfigSchema.safeParse({
        sourceUrl: 'https://node.example.com/api/v1/one/sub/token',
        overlay: {
          outbounds: [{ type: 'vless', tag: '私有节点' }],
          route: { rules: [{ action: 'route', outbound: '私有节点' }] },
        },
      }).success,
    ).toBe(true);
  });

  it('rejects a user JSON array because the root must be an object', () => {
    expect(
      overlayConfigSchema.safeParse({
        sourceUrl: 'https://node.example.com/sub/token',
        overlay: [],
      }).success,
    ).toBe(false);
  });

  it('rejects non-HTTPS source URLs', () => {
    expect(
      overlayConfigSchema.safeParse({
        sourceUrl: 'http://node.example.com/sub/token',
        overlay: {},
      }).success,
    ).toBe(false);
  });
});
