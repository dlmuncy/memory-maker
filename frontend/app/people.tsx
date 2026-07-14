import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { loadProfiles, type CharacterProfile } from "@/src/utils/localProfiles";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profiles, setProfiles] = useState<CharacterProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await loadProfiles();
      setProfiles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }: { item: CharacterProfile }) => {
    const goodCount = item.generations.filter((g) => g.rating === "good").length;
    const totalGens = item.generations.length;
    const accuracy = totalGens === 0 ? "New" : goodCount >= 3 ? "High" : goodCount >= 1 ? "Building" : "Learning";
    const accuracyColor = accuracy === "High" ? colors.brand : accuracy === "Building" ? "#F59E0B" : colors.onSurfaceTertiary;

    return (
      <Pressable
        testID={`profile-card-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/people/${item.id}`)}
      >
        {item.coverPhotoUri ? (
          <Image source={{ uri: item.coverPhotoUri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{item.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>
            {item.sourcePhotoIds.length} photo{item.sourcePhotoIds.length !== 1 ? "s" : ""} · {totalGens} memor{totalGens !== 1 ? "ies" : "y"}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: accuracy === "High" ? colors.brandTertiary : colors.surfaceTertiary }]}>
          <Text style={[styles.badgeText, { color: accuracyColor }]}>{accuracy}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="people-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="people-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>People</Text>
        <Pressable testID="add-person-btn" style={styles.addBtn} onPress={() => router.push("/people/new")}>
          <Ionicons name="person-add-outline" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <View style={styles.tipBox}>
        <Ionicons name="sparkles-outline" size={16} color={colors.onBrandTertiary} />
        <Text style={styles.tipText}>
          Add people here so the app remembers their likeness. Each memory you generate makes future ones more accurate.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : profiles.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={52} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>No people yet</Text>
          <Text style={styles.emptyText}>Tap the + to add a person. The app will learn their appearance over time.</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  addBtn: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  tipBox: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md },
  tipText: { flex: 1, fontFamily: font.regular, fontSize: type.sm, color: colors.onBrandTertiary, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md, ...shadow.card },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: font.medium, fontSize: type.xl, color: colors.brand },
  cardInfo: { flex: 1 },
  cardName: { fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface },
  cardSub: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontFamily: font.medium, fontSize: type.xs },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing["2xl"], gap: spacing.md },
  emptyTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  emptyText: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 22 },
});
