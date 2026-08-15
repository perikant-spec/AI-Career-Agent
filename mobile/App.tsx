import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts as useInstrumentSerif,
  InstrumentSerif_400Regular,
} from "@expo-google-fonts/instrument-serif";
import {
  useFonts as useInstrumentSans,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from "@expo-google-fonts/instrument-sans";
import {
  useFonts as useIBMPlexMono,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import { AuthProvider } from "@/auth/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [serifLoaded] = useInstrumentSerif({ InstrumentSerif_400Regular });
  const [sansLoaded] = useInstrumentSans({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  const [monoLoaded] = useIBMPlexMono({ IBMPlexMono_400Regular, IBMPlexMono_500Medium });

  const fontsLoaded = serifLoaded && sansLoaded && monoLoaded;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayoutRootView}>
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="dark" />
    </View>
  );
}
