# MyMemoryMakerAI

MyMemoryMakerAI is a responsive, reference-guided image-generation studio built from the supplied Stitch design and React application package. It creates new images of selected people or pets in a user-described environment and activity.

## What works

- Store up to 12 older, recent, or undated reference photos per subject
- Select up to four subjects for one generated image
- Send up to six identity references to a real multi-reference image model
- Generate square, landscape, or portrait images from a custom scene prompt
- Regenerate an existing image from natural-language refinement feedback
- Keep saved references and completed images encrypted in browser IndexedDB with AES-256-GCM
- Create client-side encrypted share packages when the resulting URL is small enough

## Generation architecture

- React 19 + TypeScript + Vite static frontend
- `@gradio/client` connects directly to the official `black-forest-labs/FLUX.2-klein-4B` Hugging Face Space
- FLUX.2 Klein 4B supports multi-reference image editing and is released under Apache-2.0
- New images are persisted only after the provider returns real image bytes
- There are no Netlify functions, Netlify packages, or Netlify storage services

The current official Hugging Face Space uses free community GPU capacity. It is suitable for functional validation, but it can queue, sleep, or exhaust a daily allowance and has no production SLA. Before commercial traffic, point the provider adapter in `src/lib/generation.ts` at dedicated/self-hosted FLUX.2 Klein 4B capacity and complete the required privacy, moderation, consent, and legal review.

## Privacy boundary

Saved records are encrypted locally before IndexedDB persistence. Generation is not fully local: after the user confirms permission and processing, selected references are decrypted in memory and transmitted over HTTPS to the disclosed Hugging Face Space. The app does not send photos during upload or ordinary library browsing.

Workspace data is tied to the current browser profile. Clearing site data removes the vault and its non-extractable key. A complete encrypted share URL is a bearer secret: anyone holding it can decrypt that shared memory.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
```

The automated suite mocks paid/limited inference while testing multi-reference selection, persistence, real-image replacement, refinements, consent enforcement, encryption, TypeScript, and the production build.

To smoke-test the live free provider with Hugging Face's own public demo references:

```bash
node scripts/smoke-generation.mjs
```
