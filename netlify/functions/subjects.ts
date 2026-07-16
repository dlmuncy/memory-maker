import { randomUUID } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import { loadPrivateJson, savePrivateJson, vaultId } from './_shared/data';
import { errorResponse, HttpError, json, methodNotAllowed, readJson } from './_shared/http';
import { cloneSeed, SEED_SUBJECTS, type Relationship, type SubjectRecord } from './_shared/seeds';

interface SubjectInput {
  name?: string;
  relationship?: Relationship;
  avatarUrl?: string;
}

const relationships: Relationship[] = ['Family', 'Friend', 'Pet', 'Other'];

export default async function handler(request: Request, context: Context) {
  try {
    const vault = vaultId(request);
    const key = `${vault}/subjects`;

    if (request.method === 'GET') {
      const subjects = await loadPrivateJson(context, key, cloneSeed(SEED_SUBJECTS));
      return json(subjects);
    }

    if (request.method === 'POST') {
      const body = await readJson<SubjectInput>(request);
      const name = body.name?.trim();
      if (!name || name.length > 80) {
        throw new HttpError(400, 'Enter a subject name between 1 and 80 characters.');
      }
      if (!body.relationship || !relationships.includes(body.relationship)) {
        throw new HttpError(400, 'Choose a valid relationship.');
      }
      if (!body.avatarUrl || body.avatarUrl.length > 4_500_000) {
        throw new HttpError(400, 'Add one portrait image smaller than 3 MB.');
      }
      if (!body.avatarUrl.startsWith('data:image/') && !body.avatarUrl.startsWith('https://')) {
        throw new HttpError(400, 'The portrait must be an uploaded image or secure image URL.');
      }

      const subjects = await loadPrivateJson<SubjectRecord[]>(context, key, cloneSeed(SEED_SUBJECTS));
      const subject: SubjectRecord = {
        id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36) || 'subject'}-${randomUUID().slice(0, 8)}`,
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
      await savePrivateJson(context, key, subjects);
      return json({ success: true, subject }, 201);
    }

    return methodNotAllowed();
  } catch (error) {
    return errorResponse(error);
  }
}

export const config: Config = {
  path: '/api/subjects',
};
