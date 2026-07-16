# MyMemoryMakerAI

MyMemoryMakerAI is a responsive memory-composition studio built from the supplied Stitch design and React application package. It lets a visitor build a private subject library, compose reconstructed memory concepts, refine them, and create expiring end-to-end encrypted share links.

## What is included

- React 19 + TypeScript + Vite interface
- Netlify Functions API
- Per-browser, AES-256-GCM-encrypted records in Netlify Blobs
- Client-side AES-GCM share encryption with the key retained in the URL fragment
- Optional Hugging Face narrative and image generation
- Curated fallback generation so the application remains usable without an inference token
- Responsive desktop and mobile navigation based on the Stitch visual system

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` starts Netlify Dev so Functions and Blobs are available locally. The Hugging Face token is optional; without it, the app uses its curated fallback engine.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ENCRYPTION_KEY` | Production | Encrypts private records before Blob storage. Use a random value with 32+ characters. |
| `HF_TOKEN` | No | Enables Hugging Face Inference Providers. Requires the inference permission. |
| `HF_TEXT_MODEL` | No | Defaults to `Qwen/Qwen2.5-3B-Instruct`. |
| `HF_IMAGE_MODEL` | No | Defaults to `black-forest-labs/FLUX.1-schnell`. |

Never expose `HF_TOKEN` or `APP_ENCRYPTION_KEY` through a `VITE_` variable; both belong only in the Netlify Functions runtime.

## Validation

```bash
npm run check
```

This performs TypeScript validation and a production build.

## Important privacy boundary

Private workspace records are encrypted at rest and namespaced to an anonymous browser vault identifier. This deployment does not yet include user accounts, device-to-device vault recovery, or access revocation. A complete share URL is a bearer secret: anyone with it can decrypt that shared memory until the package expires after 30 days.
