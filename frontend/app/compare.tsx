import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useCreate } from "@/src/context/CreateContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { toDataUri } from "@/src/utils/image";
import { colors, spacing, radius, font, type, shadow } from "@/src/theme/theme";

const ENGINE_META: Record<string, { label: string; sub: string }> = {
  gemini: { label: "Gemini · Nano Banana", sub: "Primary engine" },
  fal: { label: "fal.ai · Nano Banana", sub: "Comparison engine" },
};

export default function CompareScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { compare } = useCreate();

  if (!compare) return <Redirect href="/gallery" />;

  const renderEngine = (key: "gemini" | "fal") => {
    const r = compare[key];
    const meta = ENGINE_META[key];
    return (
      <View style={styles.card} testID={`compare-card-${key}`}>
        <View style={styles.cardHead}>
          <View>
            <Text style={styles.engineLabel}>{meta.label}</Text>
            <Text style={styles.engineSub}>{meta.sub}</Text>
          </View>
          <View style={[styles.pill, r.ok ? styles.pillOk : styles.pillFail]}>
            <Ionicons name={r.ok ? "checkmark" : "close"} size={12} color="#FFFFFF" />
            <Text style={styles.pillText}>{r.ok ? "Ready" : "Failed"}</Text>
          </View>
        </View>

        {r.ok && r.memory ? (
          <Pressable testID={`compare-open-${key}`} onPress={() => router.push(`/memory/${r.memory!.id}`)}>
            <Image source={{ uri: toDataUri(r.memory.image_base64) }} style={styles.image} contentFit="cover" transition={200} />
            <View style={styles.openHint}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              <Text style={styles.openHintText}>Tap to open</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
            <Text style={styles.errorText}>{r.error || "This engine couldn't generate an image."}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container} testID="compare-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="compare-back" style={styles.backBtn} onPress={() => router.replace("/gallery")}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Engine comparison</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.prompt} numberOfLines={3}>
          “{compare.prompt}”
        </Text>
        <Text style={styles.hint}>Both results were saved to your gallery so you can revisit them.</Text>
        {renderEngine("gemini")}
        {renderEngine("fal")}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton testID="compare-done" label="Done" onPress={() => router.replace("/gallery")} />
      </View>
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
  prompt: { fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface, marginBottom: spacing.xs },
  hint: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  engineLabel: { fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface },
  engineSub: { fontFamily: font.regular, fontSize: type.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, height: 24, borderRadius: radius.pill },
  pillOk: { backgroundColor: colors.success },
  pillFail: { backgroundColor: colors.error },
  pillText: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.sm },
  image: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  openHint: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(25,24,24,0.55)",
    paddingHorizontal: spacing.sm,
    height: 26,
    borderRadius: radius.pill,
  },
  openHintText: { color: "#FFFFFF", fontFamily: font.regular, fontSize: type.sm },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  errorText: { flex: 1, fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, lineHeight: 20 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    ...shadow.card,
  },
});
