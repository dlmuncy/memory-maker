import { cloneSeed, SEED_MEMORIES, SEED_SUBJECTS } from '../data/seeds';
import { curatedImageFor } from '../data/images';
import type { EngineStatus, Memory, Subject } from '../types';
import { loadVaultRecord, saveVaultRecord } from './vault';

interface SubjectInput {
  name?: string;
  relationship?: Subject['relationship'];
  avatarUrl?: string;
}

interface MemoryInput {
  subjects?: string[];
  setting?: string;
  medium?: string;
  notes?: string;
}

interface RefineInput {
  feedbackPrompt?: string;
}

const relationships: Subject['relationship'][] = ['Family', 'Friend', 'Pet', 'Other'];

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

function composeMemory(subjects: Subject[], setting: string, medium: string, notes: string): Memory {
  const names = subjects.map((subject) => subject.name).join(', ');
  const rememberedDetail = notes
    ? ` The remembered detail—${notes}—gives the composition a personal anchor.`
    : '';
  const now = new Date();
  return {
    id: `memory-${crypto.randomUUID()}`,
    title: titleFromSetting(setting),
    setting,
    medium,
    description: `${names} are brought together in ${setting}, rendered with the texture and atmosphere of ${medium}. The composition favors natural expressions, small gestures, and believable light so it feels like a remembered photograph rather than a staged portrait.${rememberedDetail}`,
    imageUrl: curatedImageFor(setting),
    subjectsIncluded: subjects.map((subject) => subject.id),
    date: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now),
    createdDate: now.toISOString().slice(0, 10),
    editLogs: [],
    isE2EE: true,
    sourcePrompt: `Emotionally authentic ${medium}. ${names} together in ${setting}. ${notes || 'Natural expressions and candid gestures.'} Cinematic composition, coherent anatomy, no text, no watermark.`,
    generationEngine: 'Local curated composition engine',
    generationMode: 'local-curated',
  };
}

async function subjectsRequest(method: string, init: RequestInit) {
  if (method === 'GET') return loadVaultRecord('subjects', cloneSeed(SEED_SUBJECTS));
  if (method !== 'POST') throw new Error('That subject action is not supported.');

  const body = readBody<SubjectInput>(init);
  const name = body.name?.trim() || '';
  if (!name || name.length > 80) throw new Error('Enter a subject name between 1 and 80 characters.');
  if (!body.relationship || !relationships.includes(body.relationship)) throw new Error('Choose a valid relationship.');
  if (!body.avatarUrl || body.avatarUrl.length > 4_500_000) throw new Error('Add one portrait image smaller than 3 MB.');
  if (!body.avatarUrl.startsWith('data:image/') && !body.avatarUrl.startsWith('https://')) {
    throw new Error('The portrait must be an uploaded image or secure image URL.');
  }

  const subjects = await loadVaultRecord<Subject[]>('subjects', cloneSeed(SEED_SUBJECTS));
  const subject: Subject = {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36) || 'subject'}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    relationship: body.relationship,
    avatarUrl: body.avatarUrl,
    imageCount: 1,
    recalls: 0,
    addedDate: new Date().toISOString().slice(0, 10),
    isEncrypted: true,
    encryptionAlgorithm: 'AES-256-GCM',
  };
  subjects.unshift(subject);
  await saveVaultRecord('subjects', subjects);
  return { success: true as const, subject };
}

async function memoriesRequest(method: string, init: RequestInit) {
  if (method === 'GET') return loadVaultRecord('memories', cloneSeed(SEED_MEMORIES));
  if (method !== 'POST') throw new Error('That memory action is not supported.');

  const body = readBody<MemoryInput>(init);
  if (!Array.isArray(body.subjects) || body.subjects.length < 1 || body.subjects.length > 8) {
    throw new Error('Select between one and eight subjects.');
  }
  const setting = body.setting?.trim() || '';
  const medium = body.medium?.trim() || '';
  const notes = body.notes?.trim().slice(0, 1500) || '';
  if (setting.length < 3 || setting.length > 600) throw new Error('Describe the setting in 3 to 600 characters.');
  if (medium.length < 3 || medium.length > 160) throw new Error('Choose a valid photographic style.');

  const subjects = await loadVaultRecord<Subject[]>('subjects', cloneSeed(SEED_SUBJECTS));
  const selected = subjects.filter((subject) => body.subjects?.includes(subject.id));
  if (selected.length !== body.subjects.length) throw new Error('One or more selected subjects no longer exist.');

  const memory = composeMemory(selected, setting, medium, notes);
  const memories = await loadVaultRecord<Memory[]>('memories', cloneSeed(SEED_MEMORIES));
  memories.unshift(memory);
  selected.forEach((selectedSubject) => {
    const subject = subjects.find((item) => item.id === selectedSubject.id);
    if (subject) subject.recalls += 1;
  });
  await Promise.all([
    saveVaultRecord('memories', memories),
    saveVaultRecord('subjects', subjects),
  ]);
  return memory;
}

async function refineRequest(path: string, method: string, init: RequestInit) {
  if (method !== 'POST') throw new Error('That refinement action is not supported.');
  const match = path.match(/^\/api\/memories\/([^/]+)\/edit$/);
  if (!match) throw new Error('A memory identifier is required.');
  const feedback = readBody<RefineInput>(init).feedbackPrompt?.trim() || '';
  if (feedback.length < 3 || feedback.length > 800) throw new Error('Describe the refinement in 3 to 800 characters.');

  const memories = await loadVaultRecord<Memory[]>('memories', cloneSeed(SEED_MEMORIES));
  const memory = memories.find((item) => item.id === decodeURIComponent(match[1]));
  if (!memory) throw new Error('Memory not found.');
  memory.sourcePrompt = `${memory.sourcePrompt || memory.description}. Refinement: ${feedback}`;
  memory.generationEngine = 'Local curated refinement engine';
  memory.editLogs.push({
    id: `edit-${crypto.randomUUID()}`,
    prompt: feedback,
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()),
    outcomeDescription: `Applied “${feedback}” as a non-destructive visual treatment while preserving the original memory record.`,
    imageUrl: memory.imageUrl,
  });
  await saveVaultRecord('memories', memories);
  return memory;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  if (path === '/api/health' && method === 'GET') {
    return {
      ok: true,
      storage: 'encrypted-indexeddb',
      generationEngine: 'local-curated',
    } as T;
  }
  if (path === '/api/subjects') return subjectsRequest(method, init) as Promise<T>;
  if (path === '/api/memories') return memoriesRequest(method, init) as Promise<T>;
  if (/^\/api\/memories\/[^/]+\/edit$/.test(path)) return refineRequest(path, method, init) as Promise<T>;
  throw new Error(`Unsupported local action: ${method} ${path}`);
}
