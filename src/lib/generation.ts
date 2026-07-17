import type { Client as GradioClient, SpaceStatus } from '@gradio/client';

export const GENERATION_SPACE = 'black-forest-labs/FLUX.2-klein-4B';
export const GENERATION_ENGINE = 'FLUX.2 Klein 4B via Hugging Face';

export interface GenerationProgress {
  stage: 'connecting' | 'uploading' | 'queued' | 'generating' | 'downloading' | 'complete';
  message: string;
  position?: number;
  eta?: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  images: string[];
  width?: number;
  height?: number;
  seed?: number;
  onProgress?: (progress: GenerationProgress) => void;
}

export interface ImageGenerationResult {
  imageUrl: string;
  seed: number;
}

interface ProviderFile {
  url?: string;
  path?: string;
}

interface ProviderData {
  data?: unknown[];
}

let gradioModulePromise: Promise<typeof import('@gradio/client')> | undefined;
let clientPromise: Promise<GradioClient> | undefined;

function getGradioModule() {
  gradioModulePromise ||= import('@gradio/client');
  return gradioModulePromise;
}

function providerError(error: unknown) {
  const original = error instanceof Error ? error.message : String(error || 'Unknown provider error');
  if (/quota|gpu.*limit|exceeded/i.test(original)) {
    return new Error('The free Hugging Face GPU allowance is currently exhausted. Wait for the quota to reset and try again. No memory was saved.');
  }
  if (/queue|overloaded|capacity|busy/i.test(original)) {
    return new Error('The free image generator is busy right now. Please try again in a few minutes. No memory was saved.');
  }
  if (/fetch|network|connect|offline|timeout/i.test(original)) {
    return new Error('The Hugging Face image generator could not be reached. Check your connection and try again. No memory was saved.');
  }
  return new Error(`Image generation failed: ${original}`);
}

function reportSpaceStatus(status: SpaceStatus, onProgress?: ImageGenerationRequest['onProgress']) {
  if (!onProgress) return;
  if (status.status === 'sleeping' || status.load_status === 'pending') {
    onProgress({ stage: 'connecting', message: 'Waking the Hugging Face generator…' });
  } else if (status.status === 'building') {
    onProgress({ stage: 'connecting', message: 'The image generator is updating; waiting for it to return…' });
  }
}

async function getClient(onProgress?: ImageGenerationRequest['onProgress']) {
  if (!clientPromise) {
    const { Client } = await getGradioModule();
    clientPromise = Client.connect(GENERATION_SPACE, {
      events: ['data', 'status'],
      status_callback: (status) => reportSpaceStatus(status, onProgress),
    });
  }
  return clientPromise;
}

async function dataUrlToBlob(value: string) {
  const response = await fetch(value);
  if (!response.ok) throw new Error('A selected reference photo could not be read.');
  return response.blob();
}

export async function prepareProviderFile(imageUrl: string) {
  // @gradio/client 2.3.1's handle_file() evaluates `instanceof Buffer`
  // before its Blob branch. Buffer does not exist in browsers, so pass browser
  // Blobs and remote FileData directly to the client upload walker instead.
  if (imageUrl.startsWith('data:image/')) return dataUrlToBlob(imageUrl);
  if (imageUrl.startsWith('https://')) return {
    path: imageUrl,
    url: imageUrl,
    orig_name: imageUrl.split('/').pop() || 'reference-image',
    meta: { _type: 'gradio.FileData' },
  };
  throw new Error('A selected reference photo has an unsupported address.');
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')), { once: true });
    reader.addEventListener('error', () => reject(reader.error || new Error('The generated image could not be saved.')), { once: true });
    reader.readAsDataURL(blob);
  });
}

function statusProgress(event: Record<string, unknown>): GenerationProgress {
  const progressData = Array.isArray(event.progress_data) ? event.progress_data[0] as Record<string, unknown> | undefined : undefined;
  const detail = typeof progressData?.desc === 'string' ? progressData.desc : '';
  const position = typeof event.position === 'number' ? event.position : undefined;
  const eta = typeof event.eta === 'number' ? event.eta : undefined;
  if (detail) return { stage: /generat|gpu/i.test(detail) ? 'generating' : 'queued', message: detail, position, eta };
  if (position !== undefined) return { stage: 'queued', message: `Waiting for free GPU${position ? ` · ${position} ahead` : ''}…`, position, eta };
  return { stage: 'queued', message: 'Request accepted by Hugging Face…', eta };
}

export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  if (!request.prompt.trim()) throw new Error('A generation prompt is required.');
  if (!request.images.length) throw new Error('At least one real reference photo is required.');

  request.onProgress?.({ stage: 'connecting', message: 'Connecting to the FLUX.2 Klein generator…' });
  try {
    const client = await getClient(request.onProgress);
    request.onProgress?.({ stage: 'uploading', message: `Preparing ${request.images.length} encrypted-vault reference ${request.images.length === 1 ? 'photo' : 'photos'} for generation…` });
    const inputImages = await Promise.all(request.images.map(async (imageUrl) => ({
      image: await prepareProviderFile(imageUrl),
      caption: null,
    })));

    const submission = client.submit('/infer', {
      prompt: request.prompt,
      input_images: inputImages,
      mode_choice: 'Distilled (4 steps)',
      seed: request.seed ?? Math.floor(Math.random() * 2_147_483_647),
      randomize_seed: request.seed === undefined,
      width: request.width ?? 768,
      height: request.height ?? 768,
      num_inference_steps: 4,
      guidance_scale: 1,
      prompt_upsampling: false,
    });

    let providerResult: ProviderData | undefined;
    const timeout = window.setTimeout(() => submission.cancel(), 240_000);
    try {
      for await (const event of submission) {
        if (event.type === 'status') request.onProgress?.(statusProgress(event as unknown as Record<string, unknown>));
        if (event.type === 'data') providerResult = event as ProviderData;
      }
    } finally {
      window.clearTimeout(timeout);
    }

    const file = providerResult?.data?.[0] as ProviderFile | string | undefined;
    const outputUrl = typeof file === 'string' ? file : file?.url || file?.path;
    const seed = Number(providerResult?.data?.[1]);
    if (!outputUrl) throw new Error('The generator completed without returning an image.');

    request.onProgress?.({ stage: 'downloading', message: 'Securing the generated image in this browser…' });
    const outputResponse = await fetch(outputUrl);
    if (!outputResponse.ok) throw new Error(`The generated image could not be downloaded (${outputResponse.status}).`);
    const imageUrl = await blobToDataUrl(await outputResponse.blob());
    request.onProgress?.({ stage: 'complete', message: 'Generation complete.' });
    return { imageUrl, seed: Number.isFinite(seed) ? seed : request.seed ?? 0 };
  } catch (error) {
    clientPromise = undefined;
    throw providerError(error);
  }
}
