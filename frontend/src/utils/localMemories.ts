import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MEMORIES_DIR = FileSystem.documentDirectory + "memory-maker/memories/";
const STORAGE_KEY = "mm_local_memories";

export type LocalMemory = {
  id: string;
  prompt: string;
  title: string;
  uri: string;         // local file:// URI of generated image
  source_photo_ids: string[];
  profile_ids: string[];   // character profiles that appear in this memory
  created_at: string;
};

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(MEMORIES_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MEMORIES_DIR, { intermediates: true });
}

export async function saveMemoryLocally(
  id: string,
  prompt: string,
  title: string,
  base64: string,
  sourcePhotoIds: string[],
  profileIds: string[] = []
): Promise<LocalMemory> {
  await ensureDir();
  const uri = `${MEMORIES_DIR}${id}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const memory: LocalMemory = {
    id,
    prompt,
    title,
    uri,
    source_photo_ids: sourcePhotoIds,
    profile_ids: profileIds,
    created_at: new Date().toISOString(),
  };
  const existing = await loadLocalMemories();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([memory, ...existing]));
  return memory;
}

export async function loadLocalMemories(): Promise<LocalMemory[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const memories: LocalMemory[] = JSON.parse(raw);
  const verified = await Promise.all(
    memories.map(async (m) => {
      const info = await FileSystem.getInfoAsync(m.uri);
      return info.exists ? m : null;
    })
  );
  return verified.filter((m): m is LocalMemory => m !== null);
}

export async function deleteLocalMemory(id: string): Promise<void> {
  const memories = await loadLocalMemories();
  const memory = memories.find((m) => m.id === id);
  if (memory) {
    await FileSystem.deleteAsync(memory.uri, { idempotent: true });
  }
  const updated = memories.filter((m) => m.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function getLocalMemory(id: string): Promise<LocalMemory | null> {
  const memories = await loadLocalMemories();
  return memories.find((m) => m.id === id) ?? null;
}
