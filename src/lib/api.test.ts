import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./generation', () => ({
  GENERATION_ENGINE: 'Test FLUX.2 Klein engine',
  GENERATION_SPACE: 'test/flux2-klein',
  generateImage: vi.fn(async (request: { images: string[]; onProgress?: (value: unknown) => void }) => {
    request.onProgress?.({ stage: 'generating', message: 'Generating test image…' });
    return {
      imageUrl: `data:image/webp;base64,GENERATED_${request.images.length}_${crypto.randomUUID()}`,
      seed: 4242,
    };
  }),
}));

import { apiFetch, selectGenerationReferences } from './api';
import { decryptSharedPayload, encryptSharedPayload } from './crypto';
import { resetVaultForTests } from './vault';
import type { Memory, Subject } from '../types';

const reference = (suffix: string) => `data:image/webp;base64,REFERENCE_${suffix}`;

beforeEach(resetVaultForTests);

describe('real-generation memory workflow', () => {
  it('stores multiple old/recent references, uses both for generation, and truly regenerates refinements', async () => {
    expect(await apiFetch<Subject[]>('/api/subjects')).toEqual([]);

    const created = await apiFetch<{ success: true; subject: Subject }>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Subject',
        relationship: 'Family',
        references: [
          { imageUrl: reference('RECENT'), era: 'recent' },
          { imageUrl: reference('OLDER'), era: 'older' },
        ],
      }),
    });
    expect(created.subject.imageCount).toBe(2);
    expect(selectGenerationReferences([created.subject])).toHaveLength(2);

    const updated = await apiFetch<{ success: true; subject: Subject }>(`/api/subjects/${created.subject.id}/references`, {
      method: 'POST',
      body: JSON.stringify({ references: [{ imageUrl: reference('PROFILE'), era: 'recent' }] }),
    });
    expect(updated.subject.referenceImages).toHaveLength(3);

    const progress = vi.fn();
    const memory = await apiFetch<Memory>('/api/memories', {
      method: 'POST',
      body: JSON.stringify({
        subjects: [created.subject.id],
        setting: 'Laughing together while decorating a Christmas tree in a snowy cabin',
        medium: '35mm documentary photography',
        notes: 'Warm window light',
        aspectRatio: 'landscape',
        externalProcessingConsent: true,
      }),
    }, { onProgress: progress });
    expect(memory.generationMode).toBe('hugging-face-flux2-klein');
    expect(memory.imageUrl).toContain('GENERATED_3_');
    expect(memory.referenceCount).toBe(3);
    expect(memory.generationSeed).toBe(4242);
    expect(progress).toHaveBeenCalled();

    const firstImage = memory.imageUrl;
    const refined = await apiFetch<Memory>(`/api/memories/${memory.id}/edit`, {
      method: 'POST',
      body: JSON.stringify({
        feedbackPrompt: 'Make the evening light warmer and add falling snow outside',
        externalProcessingConsent: true,
      }),
    });
    expect(refined.imageUrl).not.toBe(firstImage);
    expect(refined.editLogs).toHaveLength(1);
    expect(refined.editLogs[0].imageUrl).toBe(firstImage);
    expect((await apiFetch<Memory[]>('/api/memories'))[0].id).toBe(memory.id);
  });

  it('refuses to save a fake generation when consent or reference photos are missing', async () => {
    await expect(apiFetch('/api/memories', {
      method: 'POST',
      body: JSON.stringify({ subjects: ['missing'], setting: 'A new scene', medium: 'Photo' }),
    })).rejects.toThrow(/Confirm permission/);
    expect(await apiFetch<Memory[]>('/api/memories')).toEqual([]);
  });

  it('round-trips a self-contained encrypted share package', async () => {
    const value = { id: 'memory-test', title: 'Encrypted memory' };
    const encrypted = await encryptSharedPayload(value);
    expect(encrypted.encryptedPayload).not.toContain(value.title);
    await expect(decryptSharedPayload(encrypted.encryptedPayload, encrypted.decryptionKey)).resolves.toEqual(value);
  });
});
