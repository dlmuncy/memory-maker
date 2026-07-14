import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { createProfile } from "@/src/utils/localProfiles";
import { loadLocalPhotos, type LocalPhoto } from "@/src/utils/localPhotos";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useToast } from "@/src/components/Toast";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

const GAP = spacing.sm;
const COL_W = (Dimensions.get("window").width - spacing.lg * 2 - GAP * 2) / 3;

export default function NewPersonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadLocalPhotos();
      setPhotos(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setChosen((c) => ({ ...c, [id]: !c[id] }));
  const selectedIds = Object.entries(chosen).filter(([, v]) => v).map(([k]) => k);
  const coverPhoto = photos.find((p) => p.id === selectedIds[0]);

  const save = async () => {
    if (!name.trim()) { show("Enter a name", "info"); return; }
    if (selectedIds.length === 0) { show("Select at least one photo of this person", "info"); return; }
    setSaving(true);
    try {
      await createProfile(name.trim(), coverPhoto?.uri ?? "", selectedIds);
      show(`${name.trim()} added`, "success");
      router.back();
    } catch {
      show("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }: { item: LocalPhoto; index: number }) => {
    const isSel = !!chosen[item.id];
    return (
      <Pressable
        testID={`pick-photo-${item.id}`}
        onPress={() => toggle(item.id)}
        style={[styles.tile, { marginLeft: index % 3 === 0 ? 0 : GAP }, isSel && styles.tileSelected]}
      >
        <Image source={{ uri: item.uri }} style={styles.tileImage} contentFit="cover" />
        {isSel && (
          <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} /></View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Add a person</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={3}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              testID="person-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Mom, Dad, Grandpa Joe..."
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Select their photos</Text>
            <Text style={styles.fieldHint}>Choose all photos showing this person. More angles = better accuracy.</Text>
            {loading && <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} />}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No photos in your library yet. Add photos first, then come back.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 100 }}
        columnWrapperStyle={{ marginBottom: GAP }}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="save-person-btn"
          label={saving ? "Saving..." : selectedIds.length > 0 ? `Add ${name || "person"} with ${selectedIds.length} photo${selectedIds.length !== 1 ? "s" : ""}` : "Select photos to continue"}
          loading={saving}
          disabled={selectedIds.length === 0 || !name.trim()}
          onPress={save}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  fieldLabel: { fontFamily: font.medium, fontSize: type.base, color: colors.onSurface, marginBottom: spacing.sm, marginTop: spacing.lg },
  fieldHint: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.md, lineHeight: 18 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, fontFamily: font.regular, fontSize: type.lg, color: colors.onSurface },
  tile: { width: COL_W, height: COL_W, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary, borderWidth: 2, borderColor: "transparent" },
  tileSelected: { borderColor: colors.brand },
  tileImage: { width: "100%", height: "100%" },
  check: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyText: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, ...shadow.card },
});
