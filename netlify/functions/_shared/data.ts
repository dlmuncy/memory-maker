import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getDeployStore, getStore, type Store } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { HttpError } from './http';

interface EncryptedRecord {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
}

function encryptionKey() {
  const secret = Netlify.env.get('APP_ENCRYPTION_KEY') || 'local-development-key-change-before-production';
  return createHash('sha256').update(secret).digest();
}

function seal(value: unknown): EncryptedRecord {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

function unseal<T>(record: EncryptedRecord): T {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(record.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}

export function dataStore(context: Context, name = 'memory-maker-private'): Store {
  if (context.deploy?.context === 'production') {
    return getStore({ name, consistency: 'strong' });
  }
  return getDeployStore({ name });
}

export function vaultId(request: Request) {
  const value = request.headers.get('x-memory-vault-id') || '';
  if (!/^[a-zA-Z0-9-]{16,72}$/.test(value)) {
    throw new HttpError(400, 'A valid private vault identifier is required.');
  }
  return value;
}

export async function loadPrivateJson<T>(
  context: Context,
  key: string,
  fallback: T,
): Promise<T> {
  const record = await dataStore(context).get(key, { type: 'json' }) as EncryptedRecord | null;
  if (!record) return structuredClone(fallback);
  return unseal<T>(record);
}

export async function savePrivateJson(
  context: Context,
  key: string,
  value: unknown,
) {
  await dataStore(context).setJSON(key, seal(value));
}

export async function loadPublicJson<T>(context: Context, key: string): Promise<T | null> {
  return await dataStore(context, 'memory-maker-shares').get(key, { type: 'json' }) as T | null;
}

export async function savePublicJson(context: Context, key: string, value: unknown) {
  await dataStore(context, 'memory-maker-shares').setJSON(key, value);
}

export async function deletePublicJson(context: Context, key: string) {
  await dataStore(context, 'memory-maker-shares').delete(key);
}
