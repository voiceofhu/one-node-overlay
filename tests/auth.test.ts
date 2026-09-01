import { describe, expect, it } from 'vitest';

import { requireEditorKey, sha256Hex } from '../worker/auth';

const uuid = '6f0d4a82-3c64-4eb6-9b18-2c7e94f160d5';

describe('editor UUID key', () => {
  it('accepts a UUID bearer key and normalizes case', () => {
    const request = new Request('https://overlay.example.com/api/config', {
      headers: { Authorization: `Bearer ${uuid.toUpperCase()}` },
    });
    expect(requireEditorKey(request)).toBe(uuid);
  });

  it('rejects missing or non-UUID bearer values', () => {
    expect(() =>
      requireEditorKey(new Request('https://overlay.example.com/api/config')),
    ).toThrow();
    expect(() =>
      requireEditorKey(
        new Request('https://overlay.example.com/api/config', {
          headers: { Authorization: 'Bearer shared-token' },
        }),
      ),
    ).toThrow();
  });

  it('hashes UUID keys deterministically without exposing the UUID', async () => {
    const digest = await sha256Hex(uuid);
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain(uuid);
    await expect(sha256Hex(uuid)).resolves.toBe(digest);
  });
});
