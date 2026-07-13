import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, ActivityIndicator, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { CreateProvider } from "@/src/context/CreateContext";
import { ToastProvider } from "@/src/components/Toast";
import { colors } from "@/src/theme/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inLogin = segments[0] === "login";
    if (!user && !inLogin) {
      router.replace("/login");
    } else if (user && inLogin) {
      router.replace("/gallery");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="gallery" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="create/photos" />
      <Stack.Screen name="create/describe" />
      <Stack.Screen name="compare" />
      <Stack.Screen name="memory/[id]" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconError] = useIconFonts();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakarta_400: "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-400-normal.ttf",
    PlusJakarta_500: "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-500-normal.ttf",
  });

  const ready = (iconsLoaded || iconError) && (fontsLoaded || fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <CreateProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </CreateProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
