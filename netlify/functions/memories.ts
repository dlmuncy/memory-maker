import { randomUUID } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import { curatedImageFor, generateMemory } from './_shared/ai';
import { loadPrivateJson, savePrivateJson, vaultId } from './_shared/data';
import { errorResponse, HttpError, json, methodNotAllowed, readJson } from './_shared/http';
import {
  cloneSeed,
  SEED_MEMORIES,
  SEED_SUBJECTS,
  type MemoryRecord,
  type SubjectRecord,
} from './_shared/seeds';

interface MemoryInput {
  subjects?: string[];
  setting?: string;
  medium?: string;
  notes?: string;
}

export default async function handler(request: Request, context: Context) {
  try {
    const vault = vaultId(request);
    const memoriesKey = `${vault}/memories`;
    const subjectsKey = `${vault}/subjects`;

    if (request.method === 'GET') {
      const memories = await loadPrivateJson(context, memoriesKey, cloneSeed(SEED_MEMORIES));
      return json(memories);
    }

    if (request.method === 'POST') {
      const body = await readJson<MemoryInput>(request);
      if (!Array.isArray(body.subjects) || body.subjects.length < 1 || body.subjects.length > 8) {
        throw new HttpError(400, 'Select between one and eight subjects.');
      }
      const setting = body.setting?.trim() || '';
      const medium = body.medium?.trim() || '';
      const notes = body.notes?.trim().slice(0, 1500) || '';
      if (setting.length < 3 || setting.length > 600) {
        throw new HttpError(400, 'Describe the setting in 3 to 600 characters.');
      }
      if (medium.length < 3 || medium.length > 160) {
        throw new HttpError(400, 'Choose a valid photographic style.');
      }

      const subjects = await loadPrivateJson<SubjectRecord[]>(context, subjectsKey, cloneSeed(SEED_SUBJECTS));
      const selected = subjects.filter((subject) => body.subjects?.includes(subject.id));
      if (selected.length !== body.subjects.length) {
        throw new HttpError(400, 'One or more selected subjects no longer exist.');
      }

      const generated = await generateMemory(selected, setting, medium, notes);
      const now = new Date();
      const memory: MemoryRecord = {
        id: `memory-${randomUUID()}`,
        title: generated.title,
        setting,
        medium,
        description: generated.description,
        imageUrl: generated.imageUrl || curatedImageFor(setting),
        subjectsIncluded: body.subjects,
        date: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now),
        createdDate: now.toISOString().slice(0, 10),
        editLogs: [],
        isE2EE: true,
        sourcePrompt: generated.imagePrompt,
        generationEngine: generated.generationEngine,
        generationMode: generated.generationMode,
      };

      const memories = await loadPrivateJson<MemoryRecord[]>(context, memoriesKey, cloneSeed(SEED_MEMORIES));
      memories.unshift(memory);
      for (const subject of selected) {
        subject.recalls = (subject.recalls || 0) + 1;
      }
      await Promise.all([
        savePrivateJson(context, memoriesKey, memories),
        savePrivateJson(context, subjectsKey, subjects),
      ]);
      return json(memory, 201);
    }

    return methodNotAllowed();
  } catch (error) {
    return errorResponse(error);
  }
}

export const config: Config = {
  path: '/api/memories',
};
