const VAULT_STORAGE_KEY = 'mymemorymakerai.vault-id';

function createVaultId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `vault-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function getVaultId() {
  const existing = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (existing) return existing;

  const vaultId = createVaultId();
  window.localStorage.setItem(VAULT_STORAGE_KEY, vaultId);
  return vaultId;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-memory-vault-id', getVaultId());
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
