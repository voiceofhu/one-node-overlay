import type { OverlayConfig } from '../src/lib/config';
import { HttpError } from './errors';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectTag(value: unknown): string {
  return isObject(value) && typeof value.tag === 'string' ? value.tag.trim() : '';
}

function objectAction(value: unknown): string {
  return isObject(value) && typeof value.action === 'string' ? value.action : '';
}

function uniqueValues(overlay: unknown[], source: unknown[]): unknown[] {
  const result: unknown[] = [];
  const seen = new Set<string>();
  for (const value of [...overlay, ...source]) {
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(structuredClone(value));
  }
  return result;
}

function mergeTaggedArray(source: unknown[], overlay: unknown[], path: string[]): unknown[] {
  const overlayByTag = new Map<string, JsonObject>();
  const untaggedOverlay: unknown[] = [];
  for (const value of overlay) {
    const tag = objectTag(value);
    if (tag && isObject(value)) overlayByTag.set(tag, value);
    else untaggedOverlay.push(value);
  }

  const result = source.map((value) => {
    const tag = objectTag(value);
    const custom = tag ? overlayByTag.get(tag) : undefined;
    if (!custom) return structuredClone(value);
    overlayByTag.delete(tag);
    return mergeValue(value, custom, [...path, tag]);
  });
  for (const value of overlayByTag.values()) result.push(structuredClone(value));
  return [...untaggedOverlay.map((value) => structuredClone(value)), ...result];
}

function mergeArray(source: unknown[], overlay: unknown[], path: string[]): unknown[] {
  if (path.join('.') === 'route.rules') {
    const prerequisiteActions = new Set([
      'sniff',
      'hijack-dns',
      'resolve',
      'route-options',
    ]);
    let prerequisiteCount = 0;
    while (
      prerequisiteCount < source.length &&
      prerequisiteActions.has(objectAction(source[prerequisiteCount]))
    ) {
      prerequisiteCount += 1;
    }
    return [
      ...structuredClone(source.slice(0, prerequisiteCount)),
      ...structuredClone(overlay),
      ...structuredClone(source.slice(prerequisiteCount)),
    ];
  }
  if (path.join('.') === 'dns.rules') {
    return [...structuredClone(overlay), ...structuredClone(source)];
  }
  const tagged = [...source, ...overlay].filter((value) => objectTag(value));
  if (tagged.length > 0 && tagged.length === source.length + overlay.length) {
    return mergeTaggedArray(source, overlay, path);
  }
  return uniqueValues(overlay, source);
}

function mergeValue(source: unknown, overlay: unknown, path: string[]): unknown {
  if (isObject(source) && isObject(overlay)) {
    const result: JsonObject = structuredClone(source);
    for (const [key, value] of Object.entries(overlay)) {
      result[key] = key in result
        ? mergeValue(result[key], value, [...path, key])
        : structuredClone(value);
    }
    return result;
  }
  if (Array.isArray(source) && Array.isArray(overlay)) {
    return mergeArray(source, overlay, path);
  }
  return structuredClone(overlay);
}

export function mergeSubscription(source: unknown, config: OverlayConfig): JsonObject {
  if (!isObject(source)) {
    throw new HttpError(502, '上游不是有效的 sing-box JSON 对象');
  }
  return mergeValue(source, config.overlay, []) as JsonObject;
}
