import React, { useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { pickFromLibrary, takePhoto } from "@/src/utils/photoPicker";
import { colors, spacing, radius, font, type } from "@/src/theme/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPicked: (images: string[]) => void;
};

export function AddPhotoSheet({ visible, onClose, onPicked }: Props) {
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState(false);

  const run = async (fn: typeof pickFromLibrary) => {
    const res = await fn();
    if (res.status === "denied") {
      if (!res.canAskAgain) setBlocked(true);
      return;
    }
    if (res.status === "ok" && res.images.length > 0) {
      onPicked(res.images);
      close();
    }
  };

  const close = () => {
    setBlocked(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} testID="add-photo-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        {blocked ? (
          <View>
            <Text style={styles.title}>Permission needed</Text>
            <Text style={styles.desc}>
              Camera or photo access is turned off. Enable it in Settings to add photos.
            </Text>
            <Pressable testID="open-settings-button" style={styles.primaryRow} onPress={() => Linking.openSettings()}>
              <Ionicons name="settings-outline" size={20} color={colors.brand} />
              <Text style={styles.optionText}>Open Settings</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Add photos</Text>
            <Pressable testID="option-take-photo" style={styles.optionRow} onPress={() => run(takePhoto)}>
              <View style={styles.optionIcon}>
                <Ionicons name="camera-outline" size={22} color={colors.brand} />
              </View>
              <Text style={styles.optionText}>Take a photo</Text>
            </Pressable>
            <Pressable testID="option-choose-library" style={styles.optionRow} onPress={() => run(pickFromLibrary)}>
              <View style={styles.optionIcon}>
                <Ionicons name="images-outline" size={22} color={colors.brand} />
              </View>
              <Text style={styles.optionText}>Choose from library</Text>
            </Pressable>
          </>
        )}
        <Pressable testID="add-photo-cancel" style={styles.cancel} onPress={close}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlayDark },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: { fontFamily: font.medium, fontSize: type.xl, color: colors.onSurface, marginBottom: spacing.md },
  desc: { fontFamily: font.regular, fontSize: type.base, color: colors.onSurfaceTertiary, marginBottom: spacing.lg, lineHeight: 21 },
  optionRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  primaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  optionText: { fontFamily: font.medium, fontSize: type.lg, color: colors.onSurface },
  cancel: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: font.medium, fontSize: type.lg, color: colors.onSurfaceTertiary },
});
