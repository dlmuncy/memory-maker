import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, font, type, images, shadow } from "@/src/theme/theme";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signingIn } = useAuth();

  return (
    <View style={styles.container} testID="login-screen">
      <StatusBar style="light" />
      <Image source={{ uri: images.heroOnboarding }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(25,24,24,0.15)", "rgba(25,24,24,0.55)", "rgba(25,24,24,0.94)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl, paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={16} color={colors.brandSecondary} />
          <Text style={styles.badgeText}>AI Memory Studio</Text>
        </View>

        <View style={{ flex: 1 }} />

        <Text style={styles.title}>Relive memories that{"\n"}never happened.</Text>
        <Text style={styles.subtitle}>
          Upload a few photos of your loved ones and place them anywhere — a ski lodge, a Cancún beach, or a cruise
          through Antarctica.
        </Text>

        <Pressable
          testID="google-signin-button"
          onPress={signIn}
          disabled={signingIn}
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.9 }, signingIn && { opacity: 0.7 }]}
        >
          {signingIn ? (
            <ActivityIndicator color={colors.onSurface} />
          ) : (
            <>
              <Image
                source={{ uri: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" }}
                style={styles.googleLogo}
                contentFit="contain"
              />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.legal}>By continuing you agree to keep memories tasteful and personal.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: font.medium,
    fontSize: type.sm,
    marginLeft: spacing.xs + 2,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: font.medium,
    fontSize: type.display,
    lineHeight: 36,
    marginBottom: spacing.md,
  },
  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: font.regular,
    fontSize: type.lg,
    lineHeight: 23,
    marginBottom: spacing.xl,
  },
  googleBtn: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.floating,
  },
  googleLogo: { width: 20, height: 20, marginRight: spacing.md },
  googleText: { color: colors.onSurface, fontFamily: font.medium, fontSize: type.lg },
  legal: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: font.regular,
    fontSize: type.sm,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
