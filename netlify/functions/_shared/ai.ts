import { InferenceClient } from '@huggingface/inference';
import type { MemoryRecord, SubjectRecord } from './seeds';

const DEFAULT_TEXT_MODEL = 'Qwen/Qwen2.5-3B-Instruct';
const DEFAULT_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';

export interface GeneratedMemoryContent {
  title: string;
  description: string;
  imagePrompt: string;
  imageUrl?: string;
  generationEngine: string;
  generationMode: 'hugging-face' | 'curated-fallback';
}

export function engineConfig() {
  return {
    token: Netlify.env.get('HF_TOKEN') || '',
    textModel: Netlify.env.get('HF_TEXT_MODEL') || DEFAULT_TEXT_MODEL,
    imageModel: Netlify.env.get('HF_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL,
  };
}

function parseJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('The model response did not contain JSON.');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

function titleFromSetting(setting: string) {
  const cleaned = setting
    .replace(/[^a-zA-Z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').slice(0, 6).join(' ') || 'A Memory Reimagined';
}

function fallbackContent(
  subjects: SubjectRecord[],
  setting: string,
  medium: string,
  notes: string,
): GeneratedMemoryContent {
  const names = subjects.map((subject) => subject.name).join(', ') || 'the people you selected';
  const noteDetail = notes.trim() ? ` The remembered detail—${notes.trim()}—grounds the scene in something personal.` : '';
  const imagePrompt = `Emotionally authentic ${medium}. ${names} together in ${setting}. Natural anatomy, candid expressions, coherent hands, realistic skin texture, period-appropriate details, cinematic composition, no text, no watermark.`;

  return {
    title: titleFromSetting(setting),
    description: `${names} are brought together in ${setting}, rendered with the texture and atmosphere of ${medium}. The scene favors natural expressions, small gestures, and believable light so the result feels like a remembered photograph instead of a staged portrait.${noteDetail}`,
    imagePrompt,
    generationEngine: 'Curated offline narrative engine',
    generationMode: 'curated-fallback',
  };
}

async function generateImage(client: InferenceClient, imageModel: string, prompt: string) {
  const image = await client.textToImage({
    model: imageModel,
    provider: 'auto',
    inputs: prompt,
    parameters: {
      width: 1024,
      height: 768,
      num_inference_steps: 4,
    },
  }, { outputType: 'blob' });
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.byteLength > 4_500_000) {
    throw new Error('Generated image exceeded the safe response size.');
  }
  return `data:${image.type || 'image/png'};base64,${bytes.toString('base64')}`;
}

export async function generateMemory(
  subjects: SubjectRecord[],
  setting: string,
  medium: string,
  notes: string,
): Promise<GeneratedMemoryContent> {
  const fallback = fallbackContent(subjects, setting, medium, notes);
  const { token, textModel, imageModel } = engineConfig();
  if (!token) return fallback;

  const client = new InferenceClient(token);
  const subjectNames = subjects.map((subject) => subject.name).join(', ');
  try {
    const response = await client.chatCompletion({
      model: textModel,
      provider: 'auto',
      messages: [
        {
          role: 'system',
          content: 'You are the narrative director for MyMemoryMakerAI. Return valid JSON only. Never claim a real event occurred; describe the requested reconstruction warmly and concretely.',
        },
        {
          role: 'user',
          content: `Create a premium reconstructed-memory concept for ${subjectNames}.\nSetting: ${setting}\nPhotographic medium: ${medium}\nPersonal notes: ${notes || 'None'}\nReturn {"title":"max 6 words","description":"80-120 words","imagePrompt":"detailed photorealistic generation prompt with natural anatomy, expressions, composition, light, and no text"}.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    const parsed = parseJson(String(response.choices[0]?.message?.content || ''));
    const content: GeneratedMemoryContent = {
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 80) : fallback.title,
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 1600) : fallback.description,
      imagePrompt: typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt.slice(0, 4000) : fallback.imagePrompt,
      generationEngine: `Hugging Face · ${textModel}`,
      generationMode: 'hugging-face',
    };

    try {
      content.imageUrl = await generateImage(client, imageModel, content.imagePrompt);
      content.generationEngine = `Hugging Face · ${textModel} + ${imageModel}`;
    } catch (error) {
      console.warn('Hugging Face image generation fell back to the curated collection.', error);
    }

    return content;
  } catch (error) {
    console.warn('Hugging Face narrative generation fell back to the local engine.', error);
    return fallback;
  }
}

export function curatedImageFor(setting: string) {
  const normalized = setting.toLowerCase();
  if (/garden|dinner|party|barbecue|bbq|friend/.test(normalized)) return '/images/friends-garden.webp';
  if (/lake|family|porch|reunion|cabin|mountain|snow/.test(normalized)) return '/images/family-lake.webp';
  if (/canyon|desert|sunset/.test(normalized)) {
    return 'https://lh3.googleusercontent.com/aida-public/AB6AXuCC9Nd5YD65UrWXQe-G3XnOEsn65j_pgajstbcsP5Xjy-_zLKyzuftT2vmJXmFo_olM_Qq9vhptrnC_3nm_xN6BwPR_HJyLIUWDOASmyht96qi7iTBs7t1wZiC598L9WeWSHztHkUT163CDvVusTL0Ao6y9A_3m4yfDJW8kn-EUjr32X4f944PyFCXxs6khXfBA-Xxwqlc0wdyV-jwtu1wSZT9H-Txm64EdCONVVtZa44RuF3hTVmmp2top5evujZDsccmWR2A1xWc';
  }
  return '/images/family-lake.webp';
}

export async function refineMemory(memory: MemoryRecord, feedback: string) {
  const { token, textModel, imageModel } = engineConfig();
  const fallbackOutcome = `Applied the requested refinement: “${feedback}”. The visual treatment and source prompt were updated while preserving the original memory concept.`;
  if (!token) {
    return {
      outcome: fallbackOutcome,
      description: memory.description,
      prompt: `${memory.sourcePrompt || memory.description}. Refinement: ${feedback}`,
      imageUrl: memory.imageUrl,
      engine: 'Curated offline refinement engine',
    };
  }

  const client = new InferenceClient(token);
  try {
    const response = await client.chatCompletion({
      model: textModel,
      provider: 'auto',
      messages: [
        {
          role: 'system',
          content: 'You refine reconstructed-memory concepts. Return valid JSON only and do not invent factual claims.',
        },
        {
          role: 'user',
          content: `Current title: ${memory.title}\nCurrent description: ${memory.description}\nCurrent visual prompt: ${memory.sourcePrompt || memory.description}\nRequested change: ${feedback}\nReturn {"outcome":"one sentence","description":"revised 80-120 word description","imagePrompt":"complete revised image prompt"}.`,
        },
      ],
      max_tokens: 500,
      temperature: 0.6,
    });
    const parsed = parseJson(String(response.choices[0]?.message?.content || ''));
    const prompt = typeof parsed.imagePrompt === 'string'
      ? parsed.imagePrompt.slice(0, 4000)
      : `${memory.sourcePrompt || memory.description}. Refinement: ${feedback}`;
    let imageUrl = memory.imageUrl;
    try {
      imageUrl = await generateImage(client, imageModel, prompt);
    } catch (error) {
      console.warn('Hugging Face refinement image generation kept the prior image.', error);
    }

    return {
      outcome: typeof parsed.outcome === 'string' ? parsed.outcome.slice(0, 700) : fallbackOutcome,
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 1600) : memory.description,
      prompt,
      imageUrl,
      engine: `Hugging Face · ${textModel}`,
    };
  } catch (error) {
    console.warn('Hugging Face refinement fell back to the local engine.', error);
    return {
      outcome: fallbackOutcome,
      description: memory.description,
      prompt: `${memory.sourcePrompt || memory.description}. Refinement: ${feedback}`,
      imageUrl: memory.imageUrl,
      engine: 'Curated offline refinement engine',
    };
  }
}
