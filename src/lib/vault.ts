const DATABASE_NAME = 'mymemorymakerai-vault';
const DATABASE_VERSION = 1;
const RECORD_STORE = 'encrypted-records';
const KEY_STORE = 'vault-keys';
const PRIMARY_KEY_ID = 'primary-aes-key';

interface EncryptedRecord {
  version: 1;
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let databasePromise: Promise<IDBDatabase> | undefined;
let keyPromise: Promise<CryptoKey> | undefined;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('Browser storage request failed.')), { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('Browser storage transaction was cancelled.')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('Browser storage transaction failed.')), { once: true });
  });
}

function openDatabase() {
  databasePromise ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECORD_STORE)) database.createObjectStore(RECORD_STORE);
      if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE);
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('The encrypted browser vault could not be opened.')), { once: true });
  });
  return databasePromise;
}

async function getVaultKey() {
  keyPromise ||= (async () => {
    const database = await openDatabase();
    const readTransaction = database.transaction(KEY_STORE, 'readonly');
    const existing = await requestResult(readTransaction.objectStore(KEY_STORE).get(PRIMARY_KEY_ID)) as CryptoKey | undefined;
    if (existing) return existing;

    const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const writeTransaction = database.transaction(KEY_STORE, 'readwrite');
    writeTransaction.objectStore(KEY_STORE).put(generated, PRIMARY_KEY_ID);
    await transactionComplete(writeTransaction);
    return generated;
  })();
  return keyPromise;
}

async function seal(value: unknown): Promise<EncryptedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getVaultKey(),
    encoder.encode(JSON.stringify(value)),
  );
  return {
    version: 1,
    algorithm: 'AES-GCM',
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

async function unseal<T>(record: EncryptedRecord): Promise<T> {
  if (record.version !== 1 || record.algorithm !== 'AES-GCM') {
    throw new Error('The browser vault contains an unsupported encrypted record.');
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(record.iv) },
    await getVaultKey(),
    base64UrlToBytes(record.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function loadVaultRecord<T>(name: string, fallback: T): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(RECORD_STORE, 'readonly');
  const record = await requestResult(transaction.objectStore(RECORD_STORE).get(name)) as EncryptedRecord | undefined;
  return record ? unseal<T>(record) : structuredClone(fallback);
}

export async function saveVaultRecord(name: string, value: unknown) {
  const database = await openDatabase();
  const record = await seal(value);
  const transaction = database.transaction(RECORD_STORE, 'readwrite');
  transaction.objectStore(RECORD_STORE).put(record, name);
  await transactionComplete(transaction);
}

export async function resetVaultForTests() {
  if (databasePromise) (await databasePromise).close();
  databasePromise = undefined;
  keyPromise = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.addEventListener('success', () => resolve(), { once: true });
    request.addEventListener('blocked', () => resolve(), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('The test vault could not be reset.')), { once: true });
  });
}
