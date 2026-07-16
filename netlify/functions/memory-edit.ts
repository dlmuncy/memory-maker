import { randomUUID } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import { refineMemory } from './_shared/ai';
import { loadPrivateJson, savePrivateJson, vaultId } from './_shared/data';
import { errorResponse, HttpError, json, methodNotAllowed, readJson } from './_shared/http';
import { cloneSeed, SEED_MEMORIES, type MemoryRecord } from './_shared/seeds';

interface RefineInput {
  feedbackPrompt?: string;
}

export default async function handler(request: Request, context: Context) {
  try {
    if (request.method !== 'POST') return methodNotAllowed();
    const id = context.params.id;
    if (!id) throw new HttpError(400, 'A memory identifier is required.');
    const body = await readJson<RefineInput>(request);
    const feedback = body.feedbackPrompt?.trim() || '';
    if (feedback.length < 3 || feedback.length > 800) {
      throw new HttpError(400, 'Describe the refinement in 3 to 800 characters.');
    }

    const vault = vaultId(request);
    const key = `${vault}/memories`;
    const memories = await loadPrivateJson<MemoryRecord[]>(context, key, cloneSeed(SEED_MEMORIES));
    const index = memories.findIndex((memory) => memory.id === id);
    if (index < 0) throw new HttpError(404, 'Memory not found.');

    const memory = memories[index];
    const refined = await refineMemory(memory, feedback);
    memory.description = refined.description;
    memory.sourcePrompt = refined.prompt;
    memory.imageUrl = refined.imageUrl;
    memory.generationEngine = refined.engine;
    memory.editLogs = memory.editLogs || [];
    memory.editLogs.push({
      id: `edit-${randomUUID()}`,
      prompt: feedback,
      date: new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date()),
      outcomeDescription: refined.outcome,
      imageUrl: refined.imageUrl,
    });
    memories[index] = memory;
    await savePrivateJson(context, key, memories);
    return json(memory);
  } catch (error) {
    return errorResponse(error);
  }
}

export const config: Config = {
  path: '/api/memories/:id/edit',
};
