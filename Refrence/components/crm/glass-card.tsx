import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";
import { useColorScheme } from "nativewind";

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
};

export function GlassCard({ children, style, intensity = 40 }: GlassCardProps) {
  // بنجيب حالة التطبيق عشان نعرف هو دارك مود ولا لايت
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    // الحاوية دي عشان تدي تأثير الطيران (الرفع لفوق) وتعمل ظل سماوي خفيف بره الكارت
    <View className="hover:-translate-y-2 transition-transform duration-300" style={styles.shadowWrapper}>
      <BlurView
        experimentalBlurMethod="dimezisBlurView"
        intensity={intensity}
        // لو دارك هيبقى غامق، لو لايت هيبقى شفاف فاتح يمشي مع السماوي
        tint={isDark ? "dark" : "light"}
        style={[
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
          style
        ]}
      >
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    borderRadius: 24,
    shadowColor: "#0ea5e9", // لون ظل سماوي خفيف
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    marginVertical: 6,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardLight: {
    backgroundColor: "rgba(255, 255, 255, 0.4)", // زجاج فاتح جداً
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  cardDark: {
    backgroundColor: "rgba(15, 23, 42, 0.6)", // زجاج داكن
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});