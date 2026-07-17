import { describe, expect, it, vi } from 'vitest';
import { prepareProviderFile } from './generation';

const gradio = vi.hoisted(() => ({
  handleFile: vi.fn(() => {
    throw new Error('The Buffer-dependent Gradio helper must not run in browsers.');
  }),
}));

vi.mock('@gradio/client', () => ({
  Client: { connect: vi.fn() },
  handle_file: gradio.handleFile,
}));

describe('browser provider file preparation', () => {
  it('prepares an uploaded data URL without calling the Buffer-dependent Gradio helper', async () => {
    const result = await prepareProviderFile('data:image/png;base64,iVBORw0KGgo=');
    expect(result).toBeInstanceOf(Blob);
    expect((result as Blob).type).toBe('image/png');
    expect(gradio.handleFile).not.toHaveBeenCalled();
  });

  it('creates Gradio FileData for secure remote reference images', async () => {
    await expect(prepareProviderFile('https://example.com/current-photo.heic')).resolves.toMatchObject({
      path: 'https://example.com/current-photo.heic',
      url: 'https://example.com/current-photo.heic',
      orig_name: 'current-photo.heic',
      meta: { _type: 'gradio.FileData' },
    });
  });
});
