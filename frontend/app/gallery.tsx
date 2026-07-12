import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api/client";
import { useCreate } from "@/src/context/CreateContext";
import { toDataUri } from "@/src/utils/image";
import { colors, spacing, radius, font, type, shadow, images } from "@/src/theme/theme";

type Memory = { id: string; title: string; image_base64: string; created_at: string };

const GAP = spacing.md;
const COL_W = (Dimensions.get("window").width - spacing.lg * 2 - GAP) / 2;

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reset } = useCreate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Memory[]>("/memories");
      setMemories(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const startCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    router.push("/create/photos");
  };

  const renderItem = ({ item, index }: { item: Memory; index: number }) => (
    <Pressable
      testID={`memory-card-${item.id}`}
      onPress={() => router.push(`/memory/${item.id}`)}
      style={[styles.card, { marginLeft: index % 2 === 1 ? GAP : 0 }]}
    >
      <Image source={{ uri: toDataUri(item.image_base64) }} style={styles.cardImage} contentFit="cover" transition={200} />
      <View style={styles.cardOverlay}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
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
          <Pressable testID="my-photos-button" style={styles.iconBtn} onPress={() => router.push("/photos")}>
            <Ionicons name="images-outline" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="profile-button" style={styles.iconBtn} onPress={() => router.push("/profile")}>
            <Ionicons name="person-outline" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : memories.length === 0 ? (
        <View style={styles.empty} testID="gallery-empty">
          <Image source={{ uri: images.emptyGallery }} style={styles.emptyImage} contentFit="cover" />
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyText}>
            Create your first memory by uploading a few photos and describing the moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + 120,
          }}
          columnWrapperStyle={{ marginBottom: GAP }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brand}
            />
          }
        />
      )}

      <Pressable
        testID="create-memory-fab"
        onPress={startCreate}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing.lg }, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Ionicons name="add" size={24} color={colors.onBrandPrimary} />
        <Text style={styles.fabText}>Create Memory</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: { color: colors.onSurfaceTertiary, fontFamily: font.regular, fontSize: type.base },
  heading: { color: colors.onSurface, fontFamily: font.medium, fontSize: type["2xl"] },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: COL_W,
    height: COL_W * 1.3,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    ...shadow.card,
  },
  cardImage: { width: "100%", height: "100%" },
  cardOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: "rgba(25,24,24,0.42)",
  },
  cardTitle: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.base },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyImage: { width: 160, height: 160, borderRadius: radius.lg, marginBottom: spacing.xl, opacity: 0.9 },
  emptyTitle: { color: colors.onSurface, fontFamily: font.medium, fontSize: type.xl, marginBottom: spacing.sm },
  emptyText: { color: colors.onSurfaceTertiary, fontFamily: font.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  fab: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    height: 54,
    borderRadius: radius.pill,
    ...shadow.floating,
  },
  fabText: { color: colors.onBrandPrimary, fontFamily: font.medium, fontSize: type.lg, marginLeft: spacing.xs },
});
