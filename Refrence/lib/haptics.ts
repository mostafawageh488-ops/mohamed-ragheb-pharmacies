import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

function canUseHaptics() {
  return Platform.OS !== "web";
}

export const haptic = {
  light: () => {
    if (canUseHaptics()) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
  medium: () => {
    if (canUseHaptics()) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },
  success: () => {
    if (canUseHaptics()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  error: () => {
    if (canUseHaptics()) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
};
