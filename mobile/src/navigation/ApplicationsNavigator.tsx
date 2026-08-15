import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ApplicationsListScreen } from "@/screens/applications/ApplicationsListScreen";
import { ApplicationDetailScreen } from "@/screens/applications/ApplicationDetailScreen";
import { colors, fonts } from "@/theme/tokens";
import type { ApplicationsStackParamList } from "./types";

const Stack = createNativeStackNavigator<ApplicationsStackParamList>();

export function ApplicationsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink.primary,
        headerTitleStyle: { fontFamily: fonts.sansSemibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ApplicationsList" component={ApplicationsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ApplicationDetail" component={ApplicationDetailScreen} options={{ title: "Application" }} />
    </Stack.Navigator>
  );
}
