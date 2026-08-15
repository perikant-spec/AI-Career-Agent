import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { JobsNavigator } from "./JobsNavigator";
import { ApplicationsNavigator } from "./ApplicationsNavigator";
import { NetworkingNavigator } from "./NetworkingNavigator";
import { InterviewsNavigator } from "./InterviewsNavigator";
import { SettingsScreen } from "@/screens/settings/SettingsScreen";
import { colors, fonts } from "@/theme/tokens";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: "⌂",
  JobsTab: "◈",
  ApplicationsTab: "▤",
  NetworkingTab: "◎",
  InterviewsTab: "✎",
  Settings: "⚙",
};

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent.tealInk,
        tabBarInactiveTintColor: colors.ink.quaternary,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10.5 },
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 18, color }}>{TAB_ICONS[route.name as keyof MainTabParamList]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="JobsTab" component={JobsNavigator} options={{ title: "Jobs" }} />
      <Tab.Screen name="ApplicationsTab" component={ApplicationsNavigator} options={{ title: "Applications" }} />
      <Tab.Screen name="NetworkingTab" component={NetworkingNavigator} options={{ title: "Network" }} />
      <Tab.Screen name="InterviewsTab" component={InterviewsNavigator} options={{ title: "Interviews" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
