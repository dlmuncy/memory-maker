import * as ImagePicker from "expo-image-picker";

export type PickResult =
  | { status: "ok"; images: string[] }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "cancelled" };

function collect(res: ImagePicker.ImagePickerResult): string[] {
  if (res.canceled) return [];
  return res.assets.map((a) => a.base64).filter((b): b is string => !!b);
}

export async function pickFromLibrary(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: "denied", canAskAgain: perm.canAskAgain };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 8,
    quality: 0.6,
    base64: true,
  });
  if (res.canceled) return { status: "cancelled" };
  return { status: "ok", images: collect(res) };
}

export async function takePhoto(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: "denied", canAskAgain: perm.canAskAgain };
  const res = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    base64: true,
  });
  if (res.canceled) return { status: "cancelled" };
  return { status: "ok", images: collect(res) };
}
