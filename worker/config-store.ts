import {
  emptyOverlayConfig,
  jsonObjectSchema,
  overlayConfigSchema,
  type OverlayConfig,
} from '../src/lib/config';
import { z } from 'zod';
import { decryptConfig, encryptConfig } from './crypto';
import { sha256Hex } from './auth';
import type { Env } from './env';
import { HttpError } from './errors';

async function configKey(editorKey: string): Promise<string> {
  return `overlay:config:v2:${await sha256Hex(editorKey.toLowerCase())}`;
}

const legacyConfigSchema = z.object({
  sourceUrl: z.string(),
  outbounds: z.array(jsonObjectSchema),
  rules: z.array(jsonObjectSchema),
  includeInAuto: z.boolean(),
});

function convertLegacyConfig(value: unknown): OverlayConfig | null {
  const legacy = legacyConfigSchema.safeParse(value);
  if (!legacy.success) return null;
  const tags = legacy.data.outbounds
    .map((outbound) => (typeof outbound.tag === 'string' ? outbound.tag.trim() : ''))
    .filter(Boolean);
  const selectorOverrides: Record<string, unknown>[] = [
    { type: 'selector', tag: '节点选择', outbounds: tags },
  ];
  if (legacy.data.includeInAuto) {
    selectorOverrides.push({ type: 'urltest', tag: '自动选择', outbounds: tags });
  }
  return {
    sourceUrl: legacy.data.sourceUrl,
    overlay: {
      outbounds: [...legacy.data.outbounds, ...selectorOverrides],
      route: { rules: legacy.data.rules },
    },
  };
}

export async function readConfig(
  env: Env,
  editorKey: string,
): Promise<OverlayConfig | null> {
  const encrypted = await env.OVERLAY_CONFIG.get(await configKey(editorKey));
  if (!encrypted) return null;
  const decrypted = await decryptConfig(encrypted, env.CONFIG_ENCRYPTION_KEY);
  const parsed = overlayConfigSchema.safeParse(decrypted);
  if (!parsed.success) {
    const converted = convertLegacyConfig(decrypted);
    if (converted) return converted;
    throw new HttpError(500, '保存的 Overlay 配置未通过结构校验');
  }
  return parsed.data;
}

export async function writeConfig(
  env: Env,
  editorKey: string,
  config: OverlayConfig,
): Promise<void> {
  const encrypted = await encryptConfig(config, env.CONFIG_ENCRYPTION_KEY);
  await env.OVERLAY_CONFIG.put(await configKey(editorKey), encrypted);
}

export function initialConfig(): OverlayConfig {
  return structuredClone(emptyOverlayConfig);
}
