import { readFile, writeFile } from 'node:fs/promises';
import { Client, handle_file } from '@gradio/client';

const outputPath = process.argv[2] || '/tmp/memory-maker-generation.png';
const publicReferences = [
  'https://huggingface.co/spaces/black-forest-labs/FLUX.2-dev/resolve/main/woman1.webp',
  'https://huggingface.co/spaces/black-forest-labs/FLUX.2-dev/resolve/main/cat_window.webp',
];
const client = await Client.connect('black-forest-labs/FLUX.2-klein-4B', {
  events: ['data', 'status'],
});

const submission = client.submit('/infer', {
  prompt: 'The same woman from image 1 is having a cheerful lakeside picnic with the same cat from image 2. Keep their recognizable appearance. Candid documentary photograph, natural expression, no text, no watermark.',
  input_images: publicReferences.map((url) => ({ image: handle_file(url), caption: null })),
  mode_choice: 'Distilled (4 steps)',
  seed: 42,
  randomize_seed: false,
  width: 512,
  height: 512,
  num_inference_steps: 4,
  guidance_scale: 1,
  prompt_upsampling: false,
});

for await (const event of submission) {
  if (event.type === 'status') {
    const progress = event.progress_data?.[0]?.desc || '';
    console.log(JSON.stringify({ stage: event.stage, position: event.position, eta: event.eta, progress }));
  }
  if (event.type === 'data') {
    const result = event.data?.[0];
    const url = typeof result === 'string' ? result : result?.url;
    if (!url) throw new Error('The provider returned no image URL.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Generated image download failed (${response.status}).`);
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    console.log(JSON.stringify({ outputPath, bytes: (await readFile(outputPath)).byteLength, seed: event.data?.[1] }));
  }
}
