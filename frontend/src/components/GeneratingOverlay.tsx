import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, radius, font, type } from "@/src/theme/theme";

const MESSAGES = [
  "Studying your subjects...",
  "Recreating faces with care...",
  "Building the scene...",
  "Adding light and atmosphere...",
];

export function GeneratingOverlay() {
  const scale = useSharedValue(1);
  const [msgIndex, setMsgIndex] = React.useState(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    const t = setInterval(() => setMsgIndex((i) => (i + 1) % MESSAGES.length), 2400);
    return () => clearInterval(t);
  }, [scale]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.overlay} testID="generating-overlay">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.scrim} />
      <Animated.View style={[styles.pulse, pulseStyle]}>
        <Ionicons name="sparkles" size={40} color={colors.onBrandPrimary} />
      </Animated.View>
      <Text style={styles.title}>Creating your memory</Text>
      <Text style={styles.sub}>{MESSAGES[msgIndex]}</Text>
      <Text style={styles.hint}>This can take up to a minute.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(25,24,24,0.5)" },
  pulse: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { color: "#FFFFFF", fontFamily: font.medium, fontSize: type.xl, marginBottom: spacing.sm },
  sub: { color: "rgba(255,255,255,0.85)", fontFamily: font.regular, fontSize: type.lg, textAlign: "center" },
  hint: { color: "rgba(255,255,255,0.6)", fontFamily: font.regular, fontSize: type.sm, marginTop: spacing.md },
});
