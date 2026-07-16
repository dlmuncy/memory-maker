import { randomBytes } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import { deletePublicJson, loadPublicJson, savePublicJson, vaultId } from './_shared/data';
import { errorResponse, HttpError, json, methodNotAllowed, readJson } from './_shared/http';

interface ShareInput {
  memoryId?: string;
  encryptedPayload?: string;
}

interface ShareRecord {
  id: string;
  memoryId: string;
  encryptedPayload: string;
  createdAt: string;
  expiresAt: string;
}

export default async function handler(request: Request, context: Context) {
  try {
    if (request.method === 'POST') {
      vaultId(request);
      const body = await readJson<ShareInput>(request);
      if (!body.memoryId || !body.encryptedPayload?.startsWith('v1.')) {
        throw new HttpError(400, 'A valid AES-GCM share package is required.');
      }
      if (body.encryptedPayload.length > 5_000_000) {
        throw new HttpError(413, 'This memory is too large to share as one secure package.');
      }

      const shareId = randomBytes(18).toString('base64url');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const record: ShareRecord = {
        id: shareId,
        memoryId: body.memoryId,
        encryptedPayload: body.encryptedPayload,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      await savePublicJson(context, `share/${shareId}`, record);
      return json({ success: true, shareId, expiresAt: record.expiresAt }, 201);
    }

    if (request.method === 'GET') {
      const id = context.params.id;
      if (!id || !/^[a-zA-Z0-9_-]{20,40}$/.test(id)) {
        throw new HttpError(400, 'A valid share identifier is required.');
      }
      const record = await loadPublicJson<ShareRecord>(context, `share/${id}`);
      if (!record) throw new HttpError(404, 'This secure share does not exist or has expired.');
      if (Date.parse(record.expiresAt) <= Date.now()) {
        await deletePublicJson(context, `share/${id}`);
        throw new HttpError(404, 'This secure share has expired.');
      }
      return json(record);
    }

    return methodNotAllowed();
  } catch (error) {
    return errorResponse(error);
  }
}

export const config: Config = {
  path: ['/api/share', '/api/share/:id'],
};
