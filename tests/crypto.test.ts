import { describe, expect, it } from 'vitest';

import type { OverlayConfig } from '../src/lib/config';
import { decryptConfig, encryptConfig } from '../worker/crypto';

const encryptionKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('encrypted config storage', () => {
  it('round-trips user JSON without storing sensitive fields as plaintext', async () => {
    const config: OverlayConfig = {
      sourceUrl: 'https://node.example.com/sub/private-token',
      overlay: {
        outbounds: [{ type: 'vless', tag: '私有节点', uuid: 'private-uuid' }],
      },
    };
    const encrypted = await encryptConfig(config, encryptionKey);
    expect(encrypted).not.toContain('private-token');
    expect(encrypted).not.toContain('private-uuid');
    await expect(decryptConfig(encrypted, encryptionKey)).resolves.toEqual(config);
  });

  it('rejects keys that are not 32 bytes after Base64 decoding', async () => {
    await expect(
      encryptConfig(
        { sourceUrl: 'https://node.example.com/sub/token', overlay: {} },
        btoa('short'),
      ),
    ).rejects.toMatchObject({ status: 500 });
  });
});
