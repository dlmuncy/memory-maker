/**
 * localProfiles.ts
 * 
 * Character Profile system — each person gets a profile that accumulates
 * source photos, generation history, and best-performing reference images.
 * 
 * The more memories generated featuring a person, the more reference context
 * the app has, and the more accurate future generations become.
 */

import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const PROFILES_KEY = "mm_character_profiles";
const PROFILE_REFS_DIR = FileSystem.documentDirectory + "memory-maker/refs/";

export type GenerationRecord = {
  memoryId: string;
  memoryUri: string;       // local file:// URI of generated image
  prompt: string;
  rating: "good" | "ok" | "bad" | null;  // user rates after generation
  created_at: string;
};

export type CharacterProfile = {
  id: string;
  name: string;
  coverPhotoUri: string;   // best source photo, shown in UI
  sourcePhotoIds: string[];  // IDs from localPhotos
  generations: GenerationRecord[];  // every memory this person appeared in
  bestGenerationUris: string[];     // top-rated, used as reference context
  created_at: string;
  updated_at: string;
};

async function ensureRefsDir() {
  const info = await FileSystem.getInfoAsync(PROFILE_REFS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PROFILE_REFS_DIR, { intermediates: true });
}

export async function loadProfiles(): Promise<CharacterProfile[]> {
  const raw = await AsyncStorage.getItem(PROFILES_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as CharacterProfile[];
}

export async function saveProfiles(profiles: CharacterProfile[]): Promise<void> {
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export async function createProfile(
  name: string,
  coverPhotoUri: string,
  sourcePhotoIds: string[]
): Promise<CharacterProfile> {
  const profile: CharacterProfile = {
    id: Crypto.randomUUID(),
    name: name.trim(),
    coverPhotoUri,
    sourcePhotoIds,
    generations: [],
    bestGenerationUris: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const profiles = await loadProfiles();
  await saveProfiles([profile, ...profiles]);
  return profile;
}

export async function updateProfile(
  id: string,
  updates: Partial<Omit<CharacterProfile, "id" | "created_at">>
): Promise<CharacterProfile | null> {
  const profiles = await loadProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  profiles[idx] = { ...profiles[idx], ...updates, updated_at: new Date().toISOString() };
  await saveProfiles(profiles);
  return profiles[idx];
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = await loadProfiles();
  await saveProfiles(profiles.filter((p) => p.id !== id));
}

/**
 * After a memory is generated, record it against the selected profiles.
 * If the user later rates it "good", it gets added to bestGenerationUris.
 */
export async function recordGenerationForProfiles(
  profileIds: string[],
  memoryId: string,
  memoryUri: string,
  prompt: string
): Promise<void> {
  if (profileIds.length === 0) return;
  const profiles = await loadProfiles();
  const record: GenerationRecord = {
    memoryId,
    memoryUri,
    prompt,
    rating: null,
    created_at: new Date().toISOString(),
  };
  for (const pid of profileIds) {
    const idx = profiles.findIndex((p) => p.id === pid);
    if (idx === -1) continue;
    profiles[idx].generations = [record, ...profiles[idx].generations].slice(0, 50); // keep last 50
    profiles[idx].updated_at = new Date().toISOString();
  }
  await saveProfiles(profiles);
}

/**
 * Rate a generation for a profile. "good" ratings get promoted to
 * bestGenerationUris (used as reference context in future generations).
 */
export async function rateGeneration(
  profileId: string,
  memoryId: string,
  rating: "good" | "ok" | "bad"
): Promise<void> {
  const profiles = await loadProfiles();
  const idx = profiles.findIndex((p) => p.id === profileId);
  if (idx === -1) return;

  const genIdx = profiles[idx].generations.findIndex((g) => g.memoryId === memoryId);
  if (genIdx !== -1) {
    profiles[idx].generations[genIdx].rating = rating;
  }

  // Rebuild bestGenerationUris from all "good" rated generations (max 5 most recent)
  profiles[idx].bestGenerationUris = profiles[idx].generations
    .filter((g) => g.rating === "good")
    .slice(0, 5)
    .map((g) => g.memoryUri);

  // If no explicit "good" ratings yet, use the 3 most recent generations as soft context
  if (profiles[idx].bestGenerationUris.length === 0 && profiles[idx].generations.length > 0) {
    profiles[idx].bestGenerationUris = profiles[idx].generations
      .slice(0, 3)
      .map((g) => g.memoryUri);
  }

  profiles[idx].updated_at = new Date().toISOString();
  await saveProfiles(profiles);
}

/**
 * Get reference images for a profile to use during generation.
 * Returns base64 strings: source photos + best previous generations.
 * This is the core of the "gets smarter over time" feedback loop.
 */
export async function getProfileReferenceImages(
  profile: CharacterProfile,
  allSourcePhotosB64: string[]  // already-loaded base64 for source photos
): Promise<string[]> {
  const refs: string[] = [...allSourcePhotosB64];

  // Add best previous generations as additional reference context
  const refUris = profile.bestGenerationUris.slice(0, 3); // max 3 past generations
  for (const uri of refUris) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        refs.push(b64);
      }
    } catch {
      // File missing — skip silently
    }
  }

  return refs;
}

/**
 * Given the profiles selected for a generation and their source photos,
 * build the full enriched reference image array to send to fal.ai.
 * Source photos + up to 3 best past generations per person.
 */
export async function buildEnrichedReferenceSet(
  selectedProfileIds: string[],
  sourcePhotosB64: string[]
): Promise<string[]> {
  if (selectedProfileIds.length === 0) return sourcePhotosB64;

  const profiles = await loadProfiles();
  const selected = profiles.filter((p) => selectedProfileIds.includes(p.id));

  // Collect past generation refs for each selected profile
  const pastRefs: string[] = [];
  for (const profile of selected) {
    const refUris = profile.bestGenerationUris.slice(0, 3);
    for (const uri of refUris) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists) {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          pastRefs.push(b64);
        }
      } catch {
        // Skip missing files
      }
    }
  }

  // Source photos first (highest weight), then past generations as context
  return [...sourcePhotosB64, ...pastRefs];
}
