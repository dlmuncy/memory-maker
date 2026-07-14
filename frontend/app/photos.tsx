import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { savePhotoLocally, loadLocalPhotos, deleteLocalPhoto, type LocalPhoto } from "@/src/utils/localPhotos";
import { AddPhotoSheet } from "@/src/components/AddPhotoSheet";
import { useToast } from "@/src/components/Toast";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

const GAP = spacing.sm;
const COL_W = (Dimensions.get("window").width - spacing.lg * 2 - GAP * 2) / 3;

export default function PhotosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadLocalPhotos();
      setPhotos(data);
    } catch {
      show("Couldn't load your photos", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePicked = async (images: string[]) => {
    setSheetOpen(false);
    setSaving(true);
    try {
      for (const b64 of images) {
        await savePhotoLocally(b64);
      }
      show(`Added ${images.length} photo${images.length > 1 ? "s" : ""}`, "success");
      await load();
    } catch {
      show("Failed to save photos", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setPhotos((p) => p.filter((x) => x.id !== id));
    try {
      await deleteLocalPhoto(id);
    } catch {
      show("Delete failed", "error");
      load();
    }
  };

  const renderItem = ({ item, index }: { item: LocalPhoto; index: number }) => (
    <View style={[styles.tile, { marginLeft: index % 3 === 0 ? 0 : GAP }]}>
      <Image source={{ uri: item.uri }} style={styles.tileImage} contentFit="cover" />
      <Pressable testID={`delete-photo-${item.id}`} style={styles.deleteBtn} onPress={() => remove(item.id)} hitSlop={8}>
        <Ionicons name="close" size={14} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container} testID="photos-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="photos-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>My Photos</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          numColumns={3}
          ListHeaderComponent={
            <View style={styles.banner}>
              <Ionicons name="bulb-outline" size={20} color={colors.onBrandTertiary} />
              <Text style={styles.bannerText}>
                Add at least 3 photos per person from different angles for the most accurate memories.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="image-outline" size={48} color={colors.borderStrong} />
              <Text style={styles.emptyText}>No photos yet. Tap "Add photos" to get started.</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 100 }}
          columnWrapperStyle={{ marginBottom: GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="add-photos-button"
          label={saving ? "Saving..." : "Add photos"}
          icon="add"
          loading={saving}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      <AddPhotoSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onPicked={handlePicked} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm },
  bannerText: { flex: 1, fontFamily: font.regular, fontSize: type.base, color: colors.onBrandTertiary, lineHeight: 20 },
  tile: { width: COL_W, height: COL_W, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  tileImage: { width: "100%", height: "100%" },
  deleteBtn: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(25,24,24,0.72)", alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: spacing["3xl"], gap: spacing.md },
  emptyText: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...shadow.card },
});
