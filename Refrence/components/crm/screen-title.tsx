import { Text, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

type ScreenTitleProps = {
  eyebrow: string;
  title: string;
  description: string;
  rightAdornment?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenTitle({ eyebrow, title, description, rightAdornment, style }: ScreenTitleProps) {
  return (
    <View style={[styles.container, style]}>
      {rightAdornment ? <View style={styles.adornment}>{rightAdornment}</View> : null}
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  copy: {
    flex: 1,
  },
  adornment: {
    marginLeft: 14,
  },
  eyebrow: {
    color: "#38BDF8",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    letterSpacing: 0.3,
    lineHeight: 19,
    textAlign: "right",
    writingDirection: "rtl",
  },
  title: {
    color: "#F8FAFC",
    fontFamily: "Cairo_700Bold",
    fontSize: 27,
    lineHeight: 38,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  description: {
    color: "#94A3B8",
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    lineHeight: 22,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
