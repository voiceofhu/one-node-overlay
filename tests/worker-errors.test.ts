import { describe, expect, it } from 'vitest';

import type { Env } from '../worker/env';
import worker from '../worker/index';

const validUUID = '6f0d4a82-3c64-4eb6-9b18-2c7e94f160d5';

function emptyEnv(): Env {
  return {
    CONFIG_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    OVERLAY_CONFIG: {
      get: async () => null,
    } as unknown as KVNamespace,
  };
}

async function invoke(request: Request): Promise<Response> {
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], emptyEnv());
}

describe('Worker async error boundary', () => {
  it('returns JSON 404 instead of rejecting for an invalid subscription UUID', async () => {
    const response = await invoke(
      new Request('https://overlay.example.com/sub/not-a-uuid'),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '订阅链接不存在' });
  });

  it('returns JSON 503 instead of rejecting for an unconfigured UUID', async () => {
    const response = await invoke(
      new Request(`https://overlay.example.com/sub/${validUUID}`),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Overlay 尚未配置' });
  });

  it('returns JSON 401 instead of rejecting for an invalid editor key', async () => {
    const response = await invoke(
      new Request('https://overlay.example.com/api/config'),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '管理 UUID 无效' });
  });
});
