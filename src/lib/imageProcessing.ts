import type { ReferenceEra, SubjectReference } from '../types';

const MAX_SOURCE_BYTES = 12_000_000;
const MAX_REFERENCE_EDGE = 1_600;
const MAX_REFERENCE_BYTES = 3_500_000;

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('This browser could not optimize the image.')),
      'image/webp',
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')), { once: true });
    reader.addEventListener('error', () => reject(reader.error || new Error('The image could not be read.')), { once: true });
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.addEventListener('load', () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    }, { once: true });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`“${file.name}” is not a readable image.`));
    }, { once: true });
    image.src = objectUrl;
  });
}

export async function prepareReferenceFile(file: File, era: ReferenceEra = 'unspecified'): Promise<SubjectReference> {
  if (!file.type.startsWith('image/')) throw new Error(`“${file.name}” is not a supported image.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`“${file.name}” is larger than 12 MB.`);

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_REFERENCE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare reference photos.');
  context.drawImage(image, 0, 0, width, height);

  let optimized = await canvasBlob(canvas, 0.9);
  if (optimized.size > MAX_REFERENCE_BYTES) optimized = await canvasBlob(canvas, 0.78);
  if (optimized.size > MAX_REFERENCE_BYTES) throw new Error(`“${file.name}” could not be reduced below 3.5 MB.`);

  return {
    id: `reference-${crypto.randomUUID()}`,
    imageUrl: await blobToDataUrl(optimized),
    era,
    addedDate: new Date().toISOString(),
    fileName: file.name.slice(0, 160),
  };
}
