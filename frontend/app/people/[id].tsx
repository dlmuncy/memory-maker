import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, TextInput, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import {
  loadProfiles, deleteProfile, rateGeneration, updateProfile,
  type CharacterProfile, type GenerationRecord
} from "@/src/utils/localProfiles";
import { loadLocalPhotos } from "@/src/utils/localPhotos";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

export default function ProfileDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const profiles = await loadProfiles();
    const p = profiles.find((x) => x.id === id) ?? null;
    setProfile(p);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRate = async (memoryId: string, rating: "good" | "ok" | "bad") => {
    if (!profile) return;
    await rateGeneration(profile.id, memoryId, rating);
    await load();
  };

  const handleDelete = async () => {
    Alert.alert("Remove person?", "This will remove their profile and generation history. Your memories will stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          await deleteProfile(profile!.id);
          router.back();
        }
      }
    ]);
  };

  if (loading || !profile) {
    return <View style={styles.center}><StatusBar style="dark" /><ActivityIndicator color={colors.brand} size="large" /></View>;
  }

  const goodCount = profile.generations.filter((g) => g.rating === "good").length;
  const totalGens = profile.generations.length;
  const accuracy = totalGens === 0 ? 0 : Math.min(100, Math.round((goodCount / Math.max(totalGens, 1)) * 100 + totalGens * 5));

  return (
    <View style={styles.container} testID="profile-detail-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{profile.name}</Text>
        <Pressable style={styles.trashBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.error ?? "#EF4444"} />
        </Pressable>
      </View>

      <FlatList
        data={profile.generations}
        keyExtractor={(g) => g.memoryId}
        ListHeaderComponent={() => (
          <View>
            {/* Profile card */}
            <View style={styles.profileCard}>
              {profile.coverPhotoUri ? (
                <Image source={{ uri: profile.coverPhotoUri }} style={styles.bigAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.bigAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{profile.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.profileMeta}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileSub}>{profile.sourcePhotoIds.length} source photo{profile.sourcePhotoIds.length !== 1 ? "s" : ""}</Text>
              </View>
            </View>

            {/* Accuracy meter */}
            <View style={styles.meterSection}>
              <View style={styles.meterHeader}>
                <Text style={styles.meterLabel}>Likeness accuracy</Text>
                <Text style={styles.meterValue}>{accuracy}%</Text>
              </View>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${accuracy}%` as any }]} />
              </View>
              <Text style={styles.meterHint}>
                {totalGens === 0
                  ? "Generate your first memory featuring this person to start building accuracy."
                  : goodCount === 0
                  ? "Rate memories with 👍 to help the app learn what works for this person."
                  : `${goodCount} high-quality reference${goodCount !== 1 ? "s" : ""} saved. Future generations will use these.`}
              </Text>
            </View>

            {totalGens > 0 && <Text style={styles.sectionTitle}>Generation history</Text>}
          </View>
        )}
        renderItem={({ item }: { item: GenerationRecord }) => (
          <View style={styles.genCard} testID={`gen-card-${item.memoryId}`}>
            <Image source={{ uri: item.memoryUri }} style={styles.genThumb} contentFit="cover" />
            <View style={styles.genInfo}>
              <Text style={styles.genPrompt} numberOfLines={2}>{item.prompt}</Text>
              <Text style={styles.genDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              <View style={styles.ratingRow}>
                {(["good", "ok", "bad"] as const).map((r) => (
                  <Pressable
                    key={r}
                    testID={`rate-${r}-${item.memoryId}`}
                    onPress={() => handleRate(item.memoryId, r)}
                    style={[styles.rateBtn, item.rating === r && styles.rateBtnActive]}
                  >
                    <Text style={styles.rateEmoji}>
                      {r === "good" ? "👍" : r === "ok" ? "😐" : "👎"}
                    </Text>
                  </Pressable>
                ))}
                {item.rating && (
                  <Text style={styles.ratedLabel}>
                    {item.rating === "good" ? "✓ Used as reference" : item.rating === "bad" ? "Excluded" : "Noted"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyGens}>
            <Text style={styles.emptyGensText}>No memories yet. Create one featuring {profile.name} to start building accuracy.</Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  trashBtn: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  bigAvatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: font.medium, fontSize: type["2xl"], color: colors.brand },
  profileMeta: { flex: 1 },
  profileName: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  profileSub: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  meterSection: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  meterHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  meterLabel: { fontFamily: font.medium, fontSize: type.base, color: colors.onSurface },
  meterValue: { fontFamily: font.medium, fontSize: type.base, color: colors.brand },
  meterTrack: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden", marginBottom: spacing.sm },
  meterFill: { height: "100%", backgroundColor: colors.brand, borderRadius: radius.pill },
  meterHint: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, lineHeight: 18 },
  sectionTitle: { fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface, marginBottom: spacing.md },
  genCard: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  genThumb: { width: 88, height: 88 },
  genInfo: { flex: 1, padding: spacing.md, justifyContent: "space-between" },
  genPrompt: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurface, lineHeight: 18 },
  genDate: { fontFamily: font.regular, fontSize: type.xs, color: colors.onSurfaceTertiary },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rateBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rateBtnActive: { backgroundColor: colors.brandTertiary, borderWidth: 1.5, borderColor: colors.brand },
  rateEmoji: { fontSize: 14 },
  ratedLabel: { fontFamily: font.regular, fontSize: type.xs, color: colors.brand, marginLeft: spacing.xs },
  emptyGens: { paddingVertical: spacing.xl, alignItems: "center" },
  emptyGensText: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 22 },
});
