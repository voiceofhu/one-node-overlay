import { describe, expect, it } from 'vitest';

import type { OverlayConfig } from '../src/lib/config';
import { readConfig, writeConfig } from '../worker/config-store';
import type { Env } from '../worker/env';

const encryptionKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
const firstUUID = '6f0d4a82-3c64-4eb6-9b18-2c7e94f160d5';
const secondUUID = '341bc556-4ad0-4537-84e1-c76ad692d224';

function testEnv() {
  const values = new Map<string, string>();
  const env = {
    CONFIG_ENCRYPTION_KEY: encryptionKey,
    OVERLAY_CONFIG: {
      get: async (key: string) => values.get(key) ?? null,
      put: async (key: string, value: string) => {
        values.set(key, value);
      },
    } as KVNamespace,
  } satisfies Env;
  return { env, values };
}

describe('UUID-scoped config storage', () => {
  it('stores different UUIDs as independent encrypted records', async () => {
    const { env, values } = testEnv();
    const first: OverlayConfig = {
      sourceUrl: 'https://one.example.com/sub/first',
      overlay: { route: { final: 'first' } },
    };
    const second: OverlayConfig = {
      sourceUrl: 'https://one.example.com/sub/second',
      overlay: { route: { final: 'second' } },
    };

    await writeConfig(env, firstUUID, first);
    await writeConfig(env, secondUUID, second);

    expect(values.size).toBe(2);
    expect([...values.keys()].join(' ')).not.toContain(firstUUID);
    expect([...values.keys()].join(' ')).not.toContain(secondUUID);
    await expect(readConfig(env, firstUUID)).resolves.toEqual(first);
    await expect(readConfig(env, secondUUID)).resolves.toEqual(second);
  });

  it('returns no configuration for an unused UUID', async () => {
    const { env } = testEnv();
    await expect(readConfig(env, firstUUID)).resolves.toBeNull();
  });
});
