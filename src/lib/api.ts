import type {
  EngineStatus,
  Memory,
  ReferenceEra,
  Subject,
  SubjectReference,
} from '../types';
import {
  GENERATION_ENGINE,
  GENERATION_SPACE,
  generateImage,
  type GenerationProgress,
} from './generation';
import { loadVaultRecord, saveVaultRecord } from './vault';

interface ReferenceInput {
  id?: string;
  imageUrl?: string;
  era?: ReferenceEra;
  addedDate?: string;
  fileName?: string;
  isPrimary?: boolean;
}

interface SubjectInput {
  name?: string;
  relationship?: Subject['relationship'];
  avatarUrl?: string;
  references?: ReferenceInput[];
}

interface MemoryInput {
  subjects?: string[];
  setting?: string;
  medium?: string;
  notes?: string;
  aspectRatio?: 'landscape' | 'square' | 'portrait';
  externalProcessingConsent?: boolean;
}

interface RefineInput {
  feedbackPrompt?: string;
  externalProcessingConsent?: boolean;
}

export interface ApiOptions {
  onProgress?: (progress: GenerationProgress) => void;
}

interface SelectedReference {
  subject: Subject;
  reference: SubjectReference;
}

const relationships: Subject['relationship'][] = ['Family', 'Friend', 'Pet', 'Other'];
const eras: ReferenceEra[] = ['current', 'recent', 'older', 'unspecified'];
const legacyDemoSubjectIds = new Set(['eleanor', 'arthur', 'barnaby']);
const legacyDemoMemoryIds = new Set(['lake-weekend', 'garden-dinner', 'grand-canyon', 'winter-cabin']);

function readBody<T>(init: RequestInit): T {
  if (typeof init.body !== 'string') throw new Error('The local request body is invalid.');
  try {
    return JSON.parse(init.body) as T;
  } catch {
    throw new Error('The local request body is invalid JSON.');
  }
}

function titleFromSetting(setting: string) {
  const words = setting
    .replace(/[^a-zA-Z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6);
  return words.map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ') || 'A Memory Reimagined';
}

function validateImageAddress(imageUrl: string) {
  if (!imageUrl.startsWith('data:image/') && !imageUrl.startsWith('https://')) {
    throw new Error('Each reference must be an uploaded image or a secure image URL.');
  }
  if (imageUrl.length > 5_500_000) throw new Error('Each optimized reference image must be smaller than 4 MB.');
}

function normalizeReference(input: ReferenceInput, index: number): SubjectReference {
  const imageUrl = input.imageUrl?.trim() || '';
  validateImageAddress(imageUrl);
  const era = input.era && eras.includes(input.era) ? input.era : 'unspecified';
  return {
    id: input.id || `reference-${crypto.randomUUID()}`,
    imageUrl,
    era,
    addedDate: input.addedDate || new Date().toISOString(),
    fileName: input.fileName?.slice(0, 160),
    isPrimary: input.isPrimary || index === 0,
  };
}

function normalizedReferences(subject: Partial<Subject>) {
  if (Array.isArray(subject.referenceImages) && subject.referenceImages.length) {
    return subject.referenceImages
      .filter((reference) => reference && typeof reference.imageUrl === 'string')
      .map((reference, index) => normalizeReference(reference, index));
  }
  const avatarUrl = typeof subject.avatarUrl === 'string' ? subject.avatarUrl : '';
  if (avatarUrl && !avatarUrl.startsWith('data:image/svg+xml')) {
    return [normalizeReference({ imageUrl: avatarUrl, era: 'unspecified', isPrimary: true }, 0)];
  }
  return [];
}

function normalizeSubject(subject: Subject): Subject {
  const referenceImages = normalizedReferences(subject);
  const primary = referenceImages.find((reference) => reference.isPrimary) || referenceImages[0];
  return {
    ...subject,
    referenceImages,
    avatarUrl: primary?.imageUrl || subject.avatarUrl,
    imageCount: referenceImages.length,
  };
}

async function loadSubjects() {
  const stored = await loadVaultRecord<Subject[]>('subjects', []);
  return stored
    .map(normalizeSubject)
    .filter((subject) => !(legacyDemoSubjectIds.has(subject.id) && subject.referenceImages.length === 0));
}

async function loadMemories() {
  const stored = await loadVaultRecord<Memory[]>('memories', []);
  return stored
    .filter((memory) => !legacyDemoMemoryIds.has(memory.id))
    .map((memory) => memory.generationMode === 'local-curated'
      ? { ...memory, generationMode: 'legacy-concept' as const, generationEngine: 'Legacy concept preview (not AI generated)' }
      : memory);
}

function orderedReferences(subject: Subject) {
  const current = subject.referenceImages.filter((reference) => reference.era === 'current');
  const recent = subject.referenceImages.filter((reference) => reference.era === 'recent');
  const older = subject.referenceImages.filter((reference) => reference.era === 'older');
  const unspecified = subject.referenceImages.filter((reference) => reference.era === 'unspecified');
  const first = [current.shift(), recent.shift(), older.shift(), unspecified.shift()].filter(Boolean) as SubjectReference[];
  return [...first, ...current, ...recent, ...older, ...unspecified];
}

export function selectGenerationReferences(subjects: Subject[], limit = 6): SelectedReference[] {
  const queues = subjects.map((subject) => ({ subject, references: orderedReferences(subject) }));
  const selected: SelectedReference[] = [];
  let depth = 0;
  while (selected.length < limit) {
    let added = false;
    for (const queue of queues) {
      const reference = queue.references[depth];
      if (reference && selected.length < limit) {
        selected.push({ subject: queue.subject, reference });
        added = true;
      }
    }
    if (!added) break;
    depth += 1;
  }
  return selected;
}

function subjectReferenceDirections(selected: SelectedReference[], offset = 0) {
  const lines = new Map<string, { subject: Subject; images: string[] }>();
  selected.forEach(({ subject, reference }, index) => {
    const item = lines.get(subject.id) || { subject, images: [] };
    const era = reference.era === 'current'
      ? 'current, taken now or from the latest iPhone'
      : reference.era === 'older'
        ? 'older'
        : reference.era === 'recent'
          ? 'recent'
          : 'undated reference';
    item.images.push(`image ${index + 1 + offset} (${era} photo)`);
    lines.set(subject.id, item);
  });
  return [...lines.values()].map(({ subject, images }) => (
    `${images.join(' and ')} show ${subject.name}, the same ${subject.relationship.toLowerCase()} subject. Use every listed photo as identity evidence for ${subject.name}.`
  )).join(' ');
}

function creationPrompt(subjects: Subject[], selected: SelectedReference[], setting: string, medium: string, notes: string) {
  const names = subjects.map((subject) => subject.name);
  return [
    subjectReferenceDirections(selected),
    `Create a completely new, photorealistic scene containing exactly these ${subjects.length} selected ${subjects.length === 1 ? 'subject' : 'subjects'}: ${names.join(', ')}.`,
    `Preserve each person's or pet's recognizable identity, facial structure, coloring, and distinguishing features. Do not merge, duplicate, replace, or omit subjects. Treat current/latest-iPhone photos as the primary appearance evidence, then recent photos, unless the scene description explicitly requests a different age.`,
    `New environment and activity: ${setting}.`,
    `Photographic treatment: ${medium}.`,
    notes ? `Additional requested details: ${notes}.` : '',
    'Use natural anatomy, believable interaction, coherent hands and limbs, candid expressions, and physically consistent lighting. Do not copy the reference backgrounds. No captions, text, logos, frames, or watermarks.',
  ].filter(Boolean).join(' ');
}

function generationDimensions(aspectRatio: MemoryInput['aspectRatio']) {
  if (aspectRatio === 'portrait') return { width: 672, height: 896 };
  if (aspectRatio === 'landscape') return { width: 896, height: 672 };
  return { width: 768, height: 768 };
}

function memoryDescription(subjects: Subject[], setting: string, medium: string, notes: string) {
  const names = subjects.map((subject) => subject.name).join(', ');
  return `${names} ${subjects.length === 1 ? 'is' : 'are'} reimagined in ${setting}, generated from the selected identity references in ${medium}.${notes ? ` Details requested: ${notes}` : ''}`;
}

async function subjectsRequest(path: string, method: string, init: RequestInit) {
  if (path === '/api/subjects' && method === 'GET') return loadSubjects();

  const referenceMatch = path.match(/^\/api\/subjects\/([^/]+)\/references$/);
  if (referenceMatch && method === 'POST') {
    const body = readBody<{ references?: ReferenceInput[] }>(init);
    if (!Array.isArray(body.references) || !body.references.length) throw new Error('Add at least one reference photo.');
    const subjects = await loadSubjects();
    const subject = subjects.find((item) => item.id === decodeURIComponent(referenceMatch[1]));
    if (!subject) throw new Error('Subject not found.');
    if (subject.referenceImages.length + body.references.length > 12) throw new Error('A subject can hold up to 12 reference photos.');
    const additions = body.references.map(normalizeReference);
    subject.referenceImages.push(...additions);
    subject.imageCount = subject.referenceImages.length;
    subject.avatarUrl = subject.referenceImages.find((reference) => reference.isPrimary)?.imageUrl || subject.referenceImages[0].imageUrl;
    await saveVaultRecord('subjects', subjects);
    return { success: true as const, subject };
  }

  if (path !== '/api/subjects' || method !== 'POST') throw new Error('That subject action is not supported.');
  const body = readBody<SubjectInput>(init);
  const name = body.name?.trim() || '';
  if (!name || name.length > 80) throw new Error('Enter a subject name between 1 and 80 characters.');
  if (!body.relationship || !relationships.includes(body.relationship)) throw new Error('Choose a valid relationship.');

  const rawReferences = Array.isArray(body.references) && body.references.length
    ? body.references
    : body.avatarUrl ? [{ imageUrl: body.avatarUrl, era: 'unspecified' as const }] : [];
  if (!rawReferences.length || rawReferences.length > 12) throw new Error('Add between one and 12 reference photos.');
  const referenceImages = rawReferences.map(normalizeReference);
  const subjects = await loadSubjects();
  const subject: Subject = {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36) || 'subject'}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    relationship: body.relationship,
    avatarUrl: referenceImages[0].imageUrl,
    referenceImages,
    imageCount: referenceImages.length,
    recalls: 0,
    addedDate: new Date().toISOString().slice(0, 10),
    isEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
  };
  subjects.unshift(subject);
  await saveVaultRecord('subjects', subjects);
  return { success: true as const, subject };
}

async function memoriesRequest(method: string, init: RequestInit, options: ApiOptions) {
  if (method === 'GET') return loadMemories();
  if (method !== 'POST') throw new Error('That memory action is not supported.');

  const body = readBody<MemoryInput>(init);
  if (!Array.isArray(body.subjects) || body.subjects.length < 1 || body.subjects.length > 4) {
    throw new Error('Select between one and four subjects.');
  }
  if (body.externalProcessingConsent !== true) throw new Error('Confirm permission and Hugging Face processing before generation.');
  const setting = body.setting?.trim() || '';
  const medium = body.medium?.trim() || '';
  const notes = body.notes?.trim().slice(0, 1500) || '';
  if (setting.length < 3 || setting.length > 600) throw new Error('Describe the setting in 3 to 600 characters.');
  if (medium.length < 3 || medium.length > 160) throw new Error('Choose a valid photographic style.');

  const subjects = await loadSubjects();
  const selectedSubjects = body.subjects.map((id) => subjects.find((subject) => subject.id === id));
  if (selectedSubjects.some((subject) => !subject)) throw new Error('One or more selected subjects no longer exist.');
  const selected = selectedSubjects as Subject[];
  if (selected.some((subject) => !subject.referenceImages.length)) throw new Error('Every selected subject needs at least one real reference photo.');

  const references = selectGenerationReferences(selected, 6);
  const prompt = creationPrompt(selected, references, setting, medium, notes);
  const aspectRatio = body.aspectRatio || 'landscape';
  const result = await generateImage({
    prompt,
    images: references.map(({ reference }) => reference.imageUrl),
    ...generationDimensions(aspectRatio),
    onProgress: options.onProgress,
  });

  const now = new Date();
  const memory: Memory = {
    id: `memory-${crypto.randomUUID()}`,
    title: titleFromSetting(setting),
    setting,
    medium,
    description: memoryDescription(selected, setting, medium, notes),
    imageUrl: result.imageUrl,
    subjectsIncluded: selected.map((subject) => subject.id),
    date: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now),
    createdDate: now.toISOString().slice(0, 10),
    editLogs: [],
    isE2EE: true,
    sourcePrompt: prompt,
    generationEngine: GENERATION_ENGINE,
    generationMode: 'hugging-face-flux2-klein',
    generationProvider: `Hugging Face Space: ${GENERATION_SPACE}`,
    generationSeed: result.seed,
    referenceCount: references.length,
    externalProcessingConsentAt: now.toISOString(),
    aspectRatio,
  };
  const memories = await loadMemories();
  memories.unshift(memory);
  selected.forEach((selectedSubject) => {
    const subject = subjects.find((item) => item.id === selectedSubject.id);
    if (subject) subject.recalls += 1;
  });
  await Promise.all([saveVaultRecord('memories', memories), saveVaultRecord('subjects', subjects)]);
  return memory;
}

async function refineRequest(path: string, method: string, init: RequestInit, options: ApiOptions) {
  if (method !== 'POST') throw new Error('That refinement action is not supported.');
  const match = path.match(/^\/api\/memories\/([^/]+)\/edit$/);
  if (!match) throw new Error('A memory identifier is required.');
  const body = readBody<RefineInput>(init);
  const feedback = body.feedbackPrompt?.trim() || '';
  if (feedback.length < 3 || feedback.length > 800) throw new Error('Describe the refinement in 3 to 800 characters.');
  if (body.externalProcessingConsent !== true) throw new Error('Confirm Hugging Face processing before refinement.');

  const memories = await loadMemories();
  const memory = memories.find((item) => item.id === decodeURIComponent(match[1]));
  if (!memory) throw new Error('Memory not found.');
  const subjects = (await loadSubjects()).filter((subject) => memory.subjectsIncluded.includes(subject.id));
  const references = selectGenerationReferences(subjects, 4);
  const prompt = [
    'Image 1 is the current generated memory and is the composition to edit.',
    subjectReferenceDirections(references, 1),
    `Apply this requested change to image 1: ${feedback}.`,
    'Keep all selected subject identities recognizable and unchanged unless the request explicitly concerns age or appearance. Preserve everything else from image 1. Maintain natural anatomy and lighting. No text, logos, frames, or watermarks.',
  ].join(' ');
  const previousImageUrl = memory.imageUrl;
  const result = await generateImage({
    prompt,
    images: [previousImageUrl, ...references.map(({ reference }) => reference.imageUrl)],
    seed: memory.generationSeed,
    ...generationDimensions(memory.aspectRatio || 'landscape'),
    onProgress: options.onProgress,
  });

  memory.imageUrl = result.imageUrl;
  memory.sourcePrompt = prompt;
  memory.generationEngine = GENERATION_ENGINE;
  memory.generationMode = 'hugging-face-flux2-klein';
  memory.generationProvider = `Hugging Face Space: ${GENERATION_SPACE}`;
  memory.generationSeed = result.seed;
  memory.referenceCount = references.length;
  memory.externalProcessingConsentAt = new Date().toISOString();
  memory.editLogs.push({
    id: `edit-${crypto.randomUUID()}`,
    prompt: feedback,
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
    outcomeDescription: `Regenerated the image with “${feedback}” while retaining the previous version in revision history.`,
    imageUrl: previousImageUrl,
  });
  await saveVaultRecord('memories', memories);
  return memory;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, options: ApiOptions = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  if (path === '/api/health' && method === 'GET') {
    return {
      ok: true,
      storage: 'encrypted-indexeddb',
      generationEngine: 'hugging-face-flux2-klein',
      provider: GENERATION_SPACE,
      modelLicense: 'Apache-2.0',
      tier: 'free-community-compute',
    } as T;
  }
  if (path === '/api/subjects' || /^\/api\/subjects\/[^/]+\/references$/.test(path)) {
    return subjectsRequest(path, method, init) as Promise<T>;
  }
  if (path === '/api/memories') return memoriesRequest(method, init, options) as Promise<T>;
  if (/^\/api\/memories\/[^/]+\/edit$/.test(path)) return refineRequest(path, method, init, options) as Promise<T>;
  throw new Error(`Unsupported local action: ${method} ${path}`);
}
