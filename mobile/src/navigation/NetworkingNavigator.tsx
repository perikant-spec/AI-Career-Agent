import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ContactsListScreen } from "@/screens/networking/ContactsListScreen";
import { ContactDetailScreen } from "@/screens/networking/ContactDetailScreen";
import { colors, fonts } from "@/theme/tokens";
import type { NetworkingStackParamList } from "./types";

const Stack = createNativeStackNavigator<NetworkingStackParamList>();

export function NetworkingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink.primary,
        headerTitleStyle: { fontFamily: fonts.sansSemibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ContactsList" component={ContactsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ title: "Contact" }} />
    </Stack.Navigator>
  );
}
