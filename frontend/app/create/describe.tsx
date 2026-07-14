import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";

import { api, ApiError } from "@/src/api/client";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useToast } from "@/src/components/Toast";
import { useCreate } from "@/src/context/CreateContext";
import { toDataUri } from "@/src/utils/image";
import { colors, spacing, radius, font, type, suggestions } from "@/src/theme/theme";
import { GeneratingOverlay } from "@/src/components/GeneratingOverlay";

export default function DescribeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const { selected, prompt, setPrompt } = useCreate();
  const [generating, setGenerating] = useState(false);

  const applySuggestion = (text: string) => {
    setPrompt(prompt.trim() ? prompt : `Our family ${text}`);
  };

  const generate = async () => {
    if (!prompt.trim()) {
      show("Describe the memory first", "info");
      return;
    }
    if (selected.length === 0) {
      show("Go back and select at least one photo", "info");
      return;
    }
    setGenerating(true);
    try {
      const mem = await api<{ id: string }>("/memories/generate", {
        method: "POST",
        body: { prompt: prompt.trim(), photo_ids: selected.map((p) => p.id) },
      });
      setGenerating(false);
      router.replace(`/memory/${mem.id}`);
    } catch (e) {
      setGenerating(false);
      const msg = e instanceof ApiError ? e.message : "Generation failed. Try again.";
      show(msg, "error");
    }
  };

  return (
    <View style={styles.container} testID="describe-screen">
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="describe-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.step}>Step 2 of 2</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={90}
        contentContainerStyle={{ paddingBottom: spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Describe the memory</Text>
        <Text style={styles.subtitle}>
          Where are your subjects? What are they doing? Be vivid — the more detail, the better the likeness.
        </Text>

        <View style={styles.selectedRow}>
          {selected.slice(0, 6).map((p) => (
            <Image key={p.id} source={{ uri: toDataUri(p.image_base64) }} style={styles.thumb} contentFit="cover" />
          ))}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{selected.length}</Text>
          </View>
        </View>

        <TextInput
          testID="memory-prompt-input"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. on a family cruise through Antarctica, standing on deck with penguins nearby at golden hour"
          placeholderTextColor={colors.onSurfaceTertiary}
          multiline
          style={styles.input}
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>Need inspiration?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {suggestions.map((s) => (
            <Pressable
              key={s.label}
              testID={`suggestion-${s.label}`}
              style={styles.suggestionCard}
              onPress={() => applySuggestion(s.prompt)}
            >
              <Image source={{ uri: s.image }} style={styles.suggestionImage} contentFit="cover" />
              <View style={styles.suggestionOverlay}>
                <Text style={styles.suggestionText}>{s.label}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={16} color={colors.onBrandTertiary} />
          <Text style={styles.tipText}>
            More photos = better accuracy. Add multiple angles of each person for the closest likeness.
          </Text>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <PrimaryButton
            testID="generate-memory-button"
            label={generating ? "Creating your memory..." : "Generate Memory"}
            icon="sparkles"
            loading={generating}
            onPress={generate}
          />
        </View>
      </KeyboardStickyView>

      {generating ? <GeneratingOverlay /> : null}
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
    paddingBottom: spacing.sm,
  },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  step: { fontFamily: font.medium, fontSize: type.base, color: colors.brand },
  title: {
    fontFamily: font.medium,
    fontSize: type["2xl"],
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: type.base,
    color: colors.onSurfaceTertiary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    marginRight: spacing.xs,
    borderWidth: 2,
    borderColor: colors.surfaceSecondary,
  },
  countBadge: {
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  countText: { fontFamily: font.medium, fontSize: type.sm, color: colors.onBrandTertiary },
  input: {
    marginHorizontal: spacing.lg,
    minHeight: 130,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontFamily: font.regular,
    fontSize: type.lg,
    color: colors.onSurface,
    lineHeight: 22,
  },
  sectionLabel: {
    fontFamily: font.medium,
    fontSize: type.base,
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  suggestionCard: {
    width: 140,
    height: 96,
    borderRadius: radius.md,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: colors.surfaceTertiary,
  },
  suggestionImage: { width: "100%", height: "100%" },
  suggestionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.sm,
    backgroundColor: "rgba(25,24,24,0.45)",
  },
  suggestionText: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.sm },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
  },
  tipText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: type.sm,
    color: colors.onBrandTertiary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
