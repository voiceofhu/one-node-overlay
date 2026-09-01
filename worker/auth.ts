import { isEditorUUID } from '../src/lib/editor-path';
import { HttpError } from './errors';

const textEncoder = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function requireEditorKey(request: Request): string {
  const authorization = request.headers.get('Authorization') ?? '';
  const editorKey = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!isEditorUUID(editorKey)) {
    throw new HttpError(401, '管理 UUID 无效');
  }
  return editorKey.toLowerCase();
}
