import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type SymbolViewProps, type SymbolWeight } from "expo-symbols";
import type { ComponentProps } from "react";
import { type OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "plus.square.fill": "add-circle",
  "person.3.fill": "groups",
  "gearshape.fill": "settings",
  "cross.case.fill": "medical-services",
  "person.crop.circle.badge.plus": "person-add",
  "phone.fill": "phone",
  "banknote.fill": "payments",
  "location.fill": "location-on",
  "building.2.fill": "apartment",
  "pills.fill": "medication",
  "message.fill": "chat",
  "paperplane.fill": "send",
  "trash.fill": "delete",
  "magnifyingglass": "search",
  "clock.fill": "schedule",
  "checkmark.shield.fill": "verified-user",
  "exclamationmark.triangle.fill": "warning",
  "chevron.down": "expand-more",
  "chevron.right": "chevron-right",
  "wifi.exclamationmark": "wifi-off",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} name={MAPPING[name]} size={size} style={style} />;
}
