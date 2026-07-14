import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { loadLocalPhotos } from "@/src/utils/localPhotos";
import { loadLocalMemories } from "@/src/utils/localMemories";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [memCount, setMemCount] = useState<number | null>(null);
  const [photoCount, setPhotoCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [mems, photos] = await Promise.all([loadLocalMemories(), loadLocalPhotos()]);
      setMemCount(mems.length);
      setPhotoCount(photos.length);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <View style={styles.container} testID="profile-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="profile-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.card}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{memCount ?? "–"}</Text>
            <Text style={styles.statLabel}>Memories</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{photoCount ?? "–"}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
        </View>

        <Pressable testID="manage-photos-row" style={styles.row} onPress={() => router.push("/photos")}>
          <Ionicons name="images-outline" size={22} color={colors.onSurface} />
          <Text style={styles.rowText}>Manage my photos</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
        </Pressable>

        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton testID="sign-out-button" label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  card: {
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: spacing.md },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: font.medium, fontSize: type.display, color: colors.onBrandTertiary },
  name: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface },
  email: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: font.medium, fontSize: type["2xl"], color: colors.brand },
  statLabel: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface },
});
