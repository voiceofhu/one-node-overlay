import type { OverlayConfig } from './config';

export interface ConfigResponse {
  configured: boolean;
  config: OverlayConfig;
  subscriptionUrl: string;
}

export class ApiError extends Error {}

async function requestConfig(
  token: string,
  init?: RequestInit,
): Promise<ConfigResponse> {
  const response = await fetch('/api/config', {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | ConfigResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new ApiError(
      body && 'error' in body && body.error
        ? body.error
        : `请求失败（HTTP ${response.status}）`,
    );
  }
  return body as ConfigResponse;
}

export function loadConfig(token: string): Promise<ConfigResponse> {
  return requestConfig(token);
}

export function saveConfig(
  token: string,
  config: OverlayConfig,
): Promise<ConfigResponse> {
  return requestConfig(token, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}
