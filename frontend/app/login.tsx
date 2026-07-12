import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { useAuth, ApiError } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, type, images } from "@/src/theme/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { requestOtp, verifyOtp } = useAuth();
  const { show } = useToast();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = async () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      show("Enter a valid email address", "info");
      return;
    }
    setSending(true);
    try {
      await requestOtp(value);
      setEmail(value);
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
      show("Code sent — check your inbox", "success");
      setTimeout(() => codeRef.current?.focus(), 350);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Couldn't send the code", "error");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.trim().length !== 6) {
      show("Enter the 6-digit code", "info");
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(email, code.trim());
      // RootNavigator redirects to /gallery once user is set
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Verification failed", "error");
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setSending(true);
    try {
      await requestOtp(email);
      setCooldown(RESEND_SECONDS);
      show("New code sent", "success");
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Couldn't resend the code", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Image source={{ uri: images.heroOnboarding }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(25,24,24,0.2)", "rgba(25,24,24,0.35)", "#FBFBF9"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.badge, { top: insets.top + spacing.lg }]}>
          <Ionicons name="sparkles" size={16} color={colors.brandSecondary} />
          <Text style={styles.badgeText}>AI Memory Studio</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} keyboardVerticalOffset={0}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          {step === "email" ? (
            <>
              <Text style={styles.title}>Sign in to Memory Maker</Text>
              <Text style={styles.subtitle}>Enter your email and we'll send you a one-time code.</Text>

              <Text style={styles.label}>Email address</Text>
              <TextInput
                testID="email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.onSurfaceTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                inputMode="email"
                returnKeyType="go"
                onSubmitEditing={sendCode}
                style={styles.input}
              />

              <PrimaryButton
                testID="send-code-button"
                label={sending ? "Sending..." : "Send code"}
                loading={sending}
                onPress={sendCode}
                style={{ marginTop: spacing.lg }}
              />
            </>
          ) : (
            <>
              <Pressable testID="change-email-button" style={styles.changeEmail} onPress={() => setStep("email")}>
                <Ionicons name="chevron-back" size={18} color={colors.brand} />
                <Text style={styles.changeEmailText}>Change email</Text>
              </Pressable>

              <Text style={styles.title}>Enter your code</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to <Text style={styles.emailStrong}>{email}</Text>.
              </Text>

              <TextInput
                testID="otp-input"
                ref={codeRef}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={colors.borderStrong}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={verify}
                style={styles.codeInput}
              />

              <PrimaryButton
                testID="verify-code-button"
                label={verifying ? "Verifying..." : "Verify & continue"}
                loading={verifying}
                onPress={verify}
                style={{ marginTop: spacing.md }}
              />

              <Pressable testID="resend-code-button" style={styles.resend} onPress={resend} disabled={cooldown > 0 || sending}>
                <Text style={[styles.resendText, (cooldown > 0 || sending) && { color: colors.onSurfaceTertiary }]}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: "42%" },
  badge: {
    position: "absolute",
    left: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  badgeText: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.sm, marginLeft: spacing.xs + 2 },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  title: { fontFamily: font.medium, fontSize: type["2xl"], color: colors.onSurface, marginBottom: spacing.sm },
  subtitle: { fontFamily: font.regular, fontSize: type.lg, color: colors.onSurfaceTertiary, lineHeight: 22, marginBottom: spacing.xl },
  emailStrong: { fontFamily: font.medium, color: colors.onSurface },
  label: { fontFamily: font.medium, fontSize: type.base, color: colors.onSurface, marginBottom: spacing.sm },
  input: {
    height: 54,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: type.lg,
    color: colors.onSurface,
  },
  codeInput: {
    height: 68,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    textAlign: "center",
    fontFamily: font.medium,
    fontSize: 30,
    letterSpacing: 12,
    color: colors.onSurface,
  },
  changeEmail: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: spacing.md },
  changeEmailText: { fontFamily: font.medium, fontSize: type.base, color: colors.brand },
  resend: { alignItems: "center", paddingVertical: spacing.lg },
  resendText: { fontFamily: font.medium, fontSize: type.base, color: colors.brand },
});
