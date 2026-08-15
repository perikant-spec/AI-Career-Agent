import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { InterviewsListScreen } from "@/screens/interviews/InterviewsListScreen";
import { InterviewDetailScreen } from "@/screens/interviews/InterviewDetailScreen";
import { colors, fonts } from "@/theme/tokens";
import type { InterviewsStackParamList } from "./types";

const Stack = createNativeStackNavigator<InterviewsStackParamList>();

export function InterviewsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink.primary,
        headerTitleStyle: { fontFamily: fonts.sansSemibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="InterviewsList" component={InterviewsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="InterviewDetail" component={InterviewDetailScreen} options={{ title: "Interview prep" }} />
    </Stack.Navigator>
  );
}
