import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFetch } from './api';
import { decryptSharedPayload, encryptSharedPayload } from './crypto';
import type { Memory, Subject } from '../types';

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('mymemorymakerai-vault');
    request.addEventListener('success', () => resolve(), { once: true });
    request.addEventListener('blocked', () => resolve(), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
});

describe('browser-local memory workflow', () => {
  it('persists an encrypted subject, composes a memory, and records a refinement', async () => {
    const initialSubjects = await apiFetch<Subject[]>('/api/subjects');
    expect(initialSubjects.length).toBeGreaterThan(0);

    const created = await apiFetch<{ success: true; subject: Subject }>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Local Test Subject',
        relationship: 'Other',
        avatarUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
      }),
    });

    const memory = await apiFetch<Memory>('/api/memories', {
      method: 'POST',
      body: JSON.stringify({
        subjects: [created.subject.id],
        setting: 'A lakeside birthday picnic at sunset',
        medium: '35mm documentary photography',
        notes: 'Paper lanterns and a blue picnic blanket',
      }),
    });
    expect(memory.generationMode).toBe('local-curated');

    const refined = await apiFetch<Memory>(`/api/memories/${memory.id}/edit`, {
      method: 'POST',
      body: JSON.stringify({ feedbackPrompt: 'Make the evening light warmer' }),
    });
    expect(refined.editLogs).toHaveLength(1);
    expect((await apiFetch<Memory[]>('/api/memories'))[0].id).toBe(memory.id);
  });

  it('round-trips a self-contained encrypted share package', async () => {
    const value = { id: 'memory-test', title: 'Encrypted memory' };
    const encrypted = await encryptSharedPayload(value);
    expect(encrypted.encryptedPayload).not.toContain(value.title);
    await expect(decryptSharedPayload(encrypted.encryptedPayload, encrypted.decryptionKey)).resolves.toEqual(value);
  });
});
