import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { loadLocalMemories, type LocalMemory } from "@/src/utils/localMemories";
import { useCreate } from "@/src/context/CreateContext";
import { colors, spacing, radius, font, type, shadow, images } from "@/src/theme/theme";

const GAP = spacing.md;
const COL_W = (Dimensions.get("window").width - spacing.lg * 2 - GAP) / 2;

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reset } = useCreate();
  const [memories, setMemories] = useState<LocalMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadLocalMemories();
      setMemories(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    router.push("/create/photos");
  };

  const renderItem = ({ item, index }: { item: LocalMemory; index: number }) => (
    <Pressable
      testID={`memory-card-${item.id}`}
      onPress={() => router.push(`/memory/${item.id}`)}
      style={[styles.card, { marginLeft: index % 2 === 1 ? GAP : 0 }]}
    >
      <Image source={{ uri: item.uri }} style={styles.cardImage} contentFit="cover" transition={200} />
      <View style={styles.cardOverlay}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container} testID="gallery-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Text style={styles.greeting}>Your</Text>
          <Text style={styles.heading}>Memory Gallery</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable testID="people-button" style={styles.iconBtn} onPress={() => router.push("/people")}>
            <Ionicons name="people-outline" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="my-photos-button" style={styles.iconBtn} onPress={() => router.push("/photos")}>
            <Ionicons name="images-outline" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="profile-button" style={styles.iconBtn} onPress={() => router.push("/profile")}>
            <Ionicons name="person-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : memories.length === 0 ? (
        <View style={styles.empty} testID="gallery-empty">
          <Image source={{ uri: images.emptyGallery }} style={styles.emptyImage} contentFit="cover" />
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyText}>Tap the button below to create your first AI-powered memory.</Text>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + 100 }}
          columnWrapperStyle={{ marginBottom: GAP }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable testID="create-memory-fab" style={[styles.fab, { bottom: insets.bottom + spacing.xl }, shadow.floating]} onPress={startCreate}>
        <Ionicons name="sparkles" size={22} color={colors.onBrandPrimary} />
        <Text style={styles.fabLabel}>Create Memory</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  greeting: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary },
  heading: { fontFamily: font.medium, fontSize: type["2xl"], color: colors.onSurface },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { width: COL_W, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary, height: COL_W * 1.25 },
  cardImage: { width: "100%", height: "100%" },
  cardOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md, paddingTop: spacing.xl },
  cardTitle: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.sm, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing["2xl"] },
  emptyImage: { width: 200, height: 160, borderRadius: radius.lg, marginBottom: spacing.xl },
  emptyTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface, marginBottom: spacing.sm },
  emptyText: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 22 },
  fab: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md + 2, borderRadius: radius.pill, gap: spacing.sm },
  fabLabel: { fontFamily: font.medium, fontSize: type.lg, color: colors.onBrandPrimary },
});
