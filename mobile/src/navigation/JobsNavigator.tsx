import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { JobsListScreen } from "@/screens/jobs/JobsListScreen";
import { JobDetailScreen } from "@/screens/jobs/JobDetailScreen";
import { colors, fonts } from "@/theme/tokens";
import type { JobsStackParamList } from "./types";

const Stack = createNativeStackNavigator<JobsStackParamList>();

export function JobsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink.primary,
        headerTitleStyle: { fontFamily: fonts.sansSemibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="JobsList" component={JobsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Job" }} />
    </Stack.Navigator>
  );
}
