# MyMemoryMakerAI

MyMemoryMakerAI is a responsive memory-composition studio built from the supplied Stitch design and React application package. This version has no backend, serverless-function, hosted-database, or object-storage dependency.

## Free architecture

- Static React 19 + TypeScript + Vite application
- Free static hosting on Vercel's Hobby plan
- Browser-local IndexedDB persistence
- Non-extractable AES-256-GCM key stored by the browser
- Portrait and memory records encrypted before IndexedDB writes
- Self-contained AES-GCM share links; no server-side share record
- Local curated composition and refinement engine
- Responsive desktop and mobile navigation based on the Stitch visual system

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

This runs the browser-storage and encrypted-sharing tests, TypeScript validation, and a production build.

## Privacy boundary

Workspace data stays in the current browser profile and is not synchronized to an account or another device. Clearing site data removes the local vault and its non-extractable key. A complete share URL is a bearer secret: anyone holding it can decrypt that shared memory, and self-contained links do not expire automatically.
