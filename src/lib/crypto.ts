const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function encryptSharedPayload(value: unknown) {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(value)),
  ));

  return {
    encryptedPayload: `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`,
    decryptionKey: bytesToBase64Url(rawKey),
  };
}

export async function decryptSharedPayload<T>(encryptedPayload: string, keyValue: string): Promise<T> {
  const [version, ivValue, cipherValue] = encryptedPayload.split('.');
  if (version !== 'v1' || !ivValue || !cipherValue) {
    throw new Error('This share package uses an unsupported encryption format.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(keyValue),
    'AES-GCM',
    false,
    ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(ivValue) },
    key,
    base64UrlToBytes(cipherValue),
  );

  return JSON.parse(decoder.decode(plaintext)) as T;
}
