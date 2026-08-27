import { Salawat } from "@/components/salawat";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Tabs } from "expo-router";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  const tabBarWidth = isWeb ? Math.min(400, Math.max(280, width - 24)) : width * 0.92;
  const tabBarLeft = Math.max(0, (width - tabBarWidth) / 2);

  const renderTabIcon =
    (label: string, name: "plus.square.fill" | "person.3.fill") =>
    ({ focused }: { focused: boolean }) => (
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginTop: isWeb ? 10 : 5,
        }}
      >
        <IconSymbol
          color={focused ? "#ffc400" : "#00ff80"}
          name={name}
          size={26}
        />
        <Text
          style={{
            color: focused ? "#ffc400" : "#00ff80",
            fontFamily: "Cairo_700Bold",
            fontSize: 15,
            marginTop: 4,
          }}
        >
          {label}
        </Text>
      </View>
    );

  return (
    <>
      <Salawat />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: "absolute",
            bottom: isWeb ? 15 : Platform.OS === "ios" ? 30 : 15,
            width: tabBarWidth,
            left: tabBarLeft,
            height: 85,
            borderRadius: 40,
            backgroundColor: "rgba(1, 117, 138, 0.95)",
            borderTopWidth: 0,
            borderWidth: 1.5,
            borderColor: "rgba(0, 228, 76, 0.86)",
            paddingTop: 5,
            paddingBottom: 5,
            shadowColor: "#0ea5e9",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "تسجيل",
            tabBarIcon: renderTabIcon("تسجيل", "plus.square.fill"),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            title: "السجلات",
            tabBarIcon: renderTabIcon("السجلات", "person.3.fill"),
          }}
        />
      </Tabs>
    </>
  );
}