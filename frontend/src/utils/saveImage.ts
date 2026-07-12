import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

function stripPrefix(b64: string): string {
  return b64.startsWith("data:") ? b64.split(",", 2)[1] : b64;
}

async function writeTemp(base64: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}memory-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(uri, stripPrefix(base64), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export type SaveResult = "ok" | "denied" | "blocked" | "unsupported";

export async function saveToDevice(base64: string): Promise<SaveResult> {
  if (Platform.OS === "web") return "unsupported";
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? "denied" : "blocked";
  const uri = await writeTemp(base64);
  await MediaLibrary.saveToLibraryAsync(uri);
  return "ok";
}

export async function shareImage(base64: string): Promise<"ok" | "unsupported"> {
  if (Platform.OS === "web") return "unsupported";
  const available = await Sharing.isAvailableAsync();
  if (!available) return "unsupported";
  const uri = await writeTemp(base64);
  await Sharing.shareAsync(uri);
  return "ok";
}
