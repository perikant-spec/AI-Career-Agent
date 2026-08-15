import { ActivityIndicator, View } from "react-native";
import { AuthNavigator } from "./AuthNavigator";
import { MainTabNavigator } from "./MainTabNavigator";
import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/theme/tokens";

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent.teal} />
      </View>
    );
  }

  return user ? <MainTabNavigator /> : <AuthNavigator />;
}
