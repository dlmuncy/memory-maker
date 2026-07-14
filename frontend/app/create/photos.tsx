import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { savePhotoLocally, loadLocalPhotos, type LocalPhoto } from "@/src/utils/localPhotos";
import { AddPhotoSheet } from "@/src/components/AddPhotoSheet";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useToast } from "@/src/components/Toast";
import { useCreate } from "@/src/context/CreateContext";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

const GAP = spacing.sm;
const COL_W = (Dimensions.get("window").width - spacing.lg * 2 - GAP * 2) / 3;

export default function CreatePhotosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const { setSelected } = useCreate();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadLocalPhotos();
      setPhotos(data);
    } catch {
      show("Couldn't load photos", "error");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setChosen((c) => ({ ...c, [id]: !c[id] }));
  };

  const handlePicked = async (images: string[]) => {
    setSheetOpen(false);
    setSaving(true);
    try {
      const added: LocalPhoto[] = [];
      for (const b64 of images) {
        const p = await savePhotoLocally(b64);
        added.push(p);
      }
      setPhotos((prev) => [...added, ...prev]);
      setChosen((c) => {
        const next = { ...c };
        added.forEach((p) => (next[p.id] = true));
        return next;
      });
      show(`Added ${images.length} photo${images.length > 1 ? "s" : ""}`, "success");
    } catch {
      show("Failed to save photos", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = Object.values(chosen).filter(Boolean).length;

  const goNext = () => {
    const picked = photos.filter((p) => chosen[p.id]);
    setSelected(picked);
    router.push("/create/describe");
  };

  const renderItem = ({ item, index }: { item: LocalPhoto; index: number }) => {
    const isSel = !!chosen[item.id];
    return (
      <Pressable
        testID={`select-photo-${item.id}`}
        onPress={() => toggle(item.id)}
        style={[styles.tile, { marginLeft: index % 3 === 0 ? 0 : GAP }, isSel && styles.tileSelected]}
      >
        <Image source={{ uri: item.uri }} style={styles.tileImage} contentFit="cover" />
        {isSel ? (
          <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /></View>
        ) : (
          <View style={styles.uncheck} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="create-photos-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="create-photos-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.step}>Step 1 of 2</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.title}>Choose your subjects</Text>
      <Text style={styles.subtitle}>Pick the people to feature. Add 3+ photos of each for best accuracy.</Text>

      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          numColumns={3}
          ListHeaderComponent={
            <Pressable testID="add-new-photo-tile" style={styles.addTile} onPress={() => setSheetOpen(true)}>
              <Ionicons name="add" size={26} color={colors.brand} />
              <Text style={styles.addTileText}>Add new</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No photos yet — tap "Add new" to get started.</Text>
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + 110 }}
          columnWrapperStyle={{ marginBottom: GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="continue-to-describe"
          label={selectedCount > 0 ? `Continue with ${selectedCount} photo${selectedCount > 1 ? "s" : ""}` : "Select photos to continue"}
          disabled={selectedCount === 0}
          onPress={goNext}
        />
      </View>

      <AddPhotoSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onPicked={handlePicked} />

      {saving ? (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.savingText}>Saving photos...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  step: { fontFamily: font.medium, fontSize: type.base, color: colors.brand },
  title: { fontFamily: font.medium, fontSize: type["2xl"], color: colors.onSurface, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  subtitle: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 20 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  addTile: { width: COL_W, height: COL_W, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brandSecondary, borderStyle: "dashed", backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: GAP },
  addTileText: { fontFamily: font.medium, fontSize: type.sm, color: colors.brand, marginTop: spacing.xs },
  tile: { width: COL_W, height: COL_W, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary, borderWidth: 2, borderColor: "transparent" },
  tileSelected: { borderColor: colors.brand },
  tileImage: { width: "100%", height: "100%" },
  check: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  uncheck: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(25,24,24,0.25)" },
  emptyText: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, marginTop: spacing.xl },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...shadow.card },
  savingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlayDark, alignItems: "center", justifyContent: "center", gap: spacing.md },
  savingText: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.lg },
});
