import type { Config } from '@netlify/functions';
import { engineConfig } from './_shared/ai';
import { json } from './_shared/http';

export default async function handler() {
  const config = engineConfig();
  return json({
    ok: true,
    storage: 'netlify-blobs',
    aiConfigured: Boolean(config.token),
    textModel: config.textModel,
    imageModel: config.imageModel,
  });
}

export const config: Config = {
  path: '/api/health',
};
