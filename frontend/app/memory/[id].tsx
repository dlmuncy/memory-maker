import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { api, ApiError } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { GeneratingOverlay } from "@/src/components/GeneratingOverlay";
import { toDataUri } from "@/src/utils/image";
import { saveToDevice, shareImage } from "@/src/utils/saveImage";
import { colors, spacing, radius, font, type } from "@/src/theme/theme";

type Memory = {
  id: string;
  title: string;
  prompt: string;
  image_base64: string;
  source_photo_ids: string[];
  created_at: string;
};

export default function MemoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { show } = useToast();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await api<Memory>(`/memories/${id}`);
      setMemory(m);
    } catch {
      show("Couldn't load this memory", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, show]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSave = async () => {
    if (!memory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const res = await saveToDevice(memory.image_base64);
      if (res === "ok") show("Saved to your device", "success");
      else if (res === "unsupported") show("Saving isn't available here", "info");
      else if (res === "blocked") {
        show("Enable photo access in Settings", "error");
        Linking.openSettings();
      } else show("Permission denied", "error");
    } catch {
      show("Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    if (!memory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await shareImage(memory.image_base64);
      if (res === "unsupported") show("Sharing isn't available here", "info");
    } catch {
      show("Share failed", "error");
    }
  };

  const onRegenerate = async () => {
    if (!memory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRegenerating(true);
    try {
      const mem = await api<{ id: string }>("/memories/generate", {
        method: "POST",
        body: { prompt: memory.prompt, photo_ids: memory.source_photo_ids },
      });
      setRegenerating(false);
      router.replace(`/memory/${mem.id}`);
    } catch (e) {
      setRegenerating(false);
      show(e instanceof ApiError ? e.message : "Regeneration failed", "error");
    }
  };

  const onDelete = async () => {
    if (!memory) return;
    setBusy(true);
    try {
      await api(`/memories/${memory.id}`, { method: "DELETE" });
      show("Memory deleted", "success");
      router.replace("/gallery");
    } catch {
      show("Delete failed", "error");
      setBusy(false);
    }
  };

  if (loading || !memory) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="memory-detail-screen">
      <StatusBar style="light" />
      <Image source={{ uri: toDataUri(memory.image_base64) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />

      <LinearGradient colors={["rgba(25,24,24,0.7)", "transparent"]} style={styles.topScrim} />
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Pressable testID="memory-back" style={styles.roundBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable testID="memory-delete" style={styles.roundBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <BlurView intensity={50} tint="dark" style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title} numberOfLines={2}>
          {memory.title}
        </Text>
        <Text style={styles.prompt} numberOfLines={3}>
          {memory.prompt}
        </Text>

        <View style={styles.actionRow}>
          <Action testID="save-memory" icon="download-outline" label="Save" onPress={onSave} disabled={busy} />
          <Action testID="share-memory" icon="share-outline" label="Share" onPress={onShare} disabled={busy} />
          <Action testID="regenerate-memory" icon="refresh-outline" label="Regenerate" onPress={onRegenerate} disabled={busy} />
        </View>
      </BlurView>

      {regenerating ? <GeneratingOverlay /> : null}
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }, disabled && { opacity: 0.5 }]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  loadingContainer: { flex: 1, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 140 },
  topBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(25,24,24,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    overflow: "hidden",
  },
  title: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.xl, marginBottom: spacing.xs },
  prompt: { color: "rgba(255,255,255,0.8)", fontFamily: font.regular, fontSize: type.base, lineHeight: 20, marginBottom: spacing.xl },
  actionRow: { flexDirection: "row", justifyContent: "space-around" },
  action: { alignItems: "center", gap: spacing.sm },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: "#FFFFFF", fontFamily: font.regular, fontSize: type.sm },
});
