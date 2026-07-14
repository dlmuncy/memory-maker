import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PHOTOS_DIR = FileSystem.documentDirectory + "memory-maker/photos/";
const STORAGE_KEY = "mm_local_photos";

export type LocalPhoto = {
  id: string;
  uri: string;         // local file:// URI
  created_at: string;
};

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
}

export async function savePhotoLocally(base64: string): Promise<LocalPhoto> {
  await ensureDir();
  const id = Crypto.randomUUID();
  const uri = `${PHOTOS_DIR}${id}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const photo: LocalPhoto = { id, uri, created_at: new Date().toISOString() };
  const existing = await loadLocalPhotos();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([photo, ...existing]));
  return photo;
}

export async function loadLocalPhotos(): Promise<LocalPhoto[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const photos: LocalPhoto[] = JSON.parse(raw);
  // Filter out any whose files were deleted externally
  const verified = await Promise.all(
    photos.map(async (p) => {
      const info = await FileSystem.getInfoAsync(p.uri);
      return info.exists ? p : null;
    })
  );
  return verified.filter((p): p is LocalPhoto => p !== null);
}

export async function deleteLocalPhoto(id: string): Promise<void> {
  const photos = await loadLocalPhotos();
  const photo = photos.find((p) => p.id === id);
  if (photo) {
    await FileSystem.deleteAsync(photo.uri, { idempotent: true });
  }
  const updated = photos.filter((p) => p.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function photoToBase64(uri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
