# Memory Maker — PRD

## Original Problem Statement
Take user-uploaded photos and create memorable photos of the subjects in ordinary and
extraordinary places/events (e.g., family ski lodge, Cancún, Antarctica cruise). Must be
highly accurate at reproducing the subjects and placing them in described environments.
Users are guided to upload 3+ photos / different angles per person. Photos are retained so
recreations improve over time. Ultimately recreates whatever subjects are uploaded and
places them into the requested environment.

## User Choices
- Image engine: **Gemini "Nano Banana"** (`gemini-3.1-flash-image-preview`) via EMERGENT_LLM_KEY
- Model: photo pool + free-text description
- Auth: **Emergent-managed Google login**
- Output: generated image
- Design: clean & modern (warm "iOS-Native Clean" palette, terracotta on bone-white)

## Architecture
- **Frontend**: Expo Router (stack navigation), react-native-keyboard-controller, expo-image,
  expo-blur, expo-linear-gradient, reanimated. Auth + Create + Toast contexts.
- **Backend**: FastAPI + MongoDB (motor). Emergent Google Auth (session exchange + Bearer),
  Photos CRUD, Memory generation via emergentintegrations LlmChat (multi reference images).
- **Storage**: images stored as base64 in MongoDB, scoped by user_id.

## User Persona
Families / individuals who want to imagine & keep photorealistic "memories" of themselves in
places they haven't been.

## Core Requirements (static)
- Accurate subject reproduction placed into described scenes.
- Persistent per-user photo library (add 3+ per person).
- Create flow: select photos -> describe -> generate -> view/save/share/regenerate.

## Implemented (2026-07-12)
- Google login (Emergent OAuth), auth gating, sign out, profile with stats.
- My Photos library: add via camera/gallery (permission-handled), delete.
- Create flow: photo selection (multi) + inline add, describe with suggestion cards
  (Ski Lodge / Cancún / Antarctica), generating overlay.
- Memory generation via Gemini Nano Banana (multiple reference photos + prompt) — REAL, tested.
- Memory gallery (grid, pull-to-refresh, empty state), memory detail (full-bleed image,
  glass action sheet: Save to device, Share, Regenerate, Delete).
- Backend: 25/25 tests passed incl. real generation.

## Backlog
- P1: Named "People/Subjects" grouping within the photo pool for multi-person accuracy.
- P1: AI caption/short story per memory; optional short video clip.
- P2: Cloud sync polish, on-device caching of results, share-to-social presets.
- P2: base64 upload size validation / resizing on backend; multiple output variants per generate.

## Next Tasks
- Gather real-device QA for camera/media-library permissions (not testable in Expo Go web).
- Add subject grouping (P1) if user wants sharper multi-person fidelity.
