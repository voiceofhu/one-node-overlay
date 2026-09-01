import type { OverlayConfig } from '../src/lib/config';
import { HttpError } from './errors';

interface EncryptedRecord {
  version: 1;
  iv: string;
  ciphertext: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(500, 'CONFIG_ENCRYPTION_KEY 不是有效的 Base64');
  }
}

async function importEncryptionKey(encodedKey: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(encodedKey.trim());
  if (keyBytes.byteLength !== 32) {
    throw new HttpError(500, 'CONFIG_ENCRYPTION_KEY 解码后必须是 32 字节');
  }
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptConfig(
  config: OverlayConfig,
  encodedKey: string,
): Promise<string> {
  const key = await importEncryptionKey(encodedKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(config)),
  );
  const record: EncryptedRecord = {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(record);
}

export async function decryptConfig(
  value: string,
  encodedKey: string,
): Promise<unknown> {
  let record: EncryptedRecord;
  try {
    record = JSON.parse(value) as EncryptedRecord;
  } catch {
    throw new HttpError(500, 'KV 中的 Overlay 配置格式无效');
  }
  if (record.version !== 1 || !record.iv || !record.ciphertext) {
    throw new HttpError(500, 'KV 中的 Overlay 配置版本无效');
  }
  try {
    const key = await importEncryptionKey(encodedKey);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.ciphertext),
    );
    return JSON.parse(textDecoder.decode(plaintext));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, '无法解密 Overlay 配置，请检查加密密钥');
  }
}
