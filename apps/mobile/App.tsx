import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SessionDetailScreen } from './src/screens/SessionDetailScreen';
import { ThemeProvider, useTheme } from './src/ThemeContext';

const Stack = createNativeStackNavigator();

function MainNavigator() {
  const { colors, isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await AsyncStorage.getItem('visionfit.auth.user');
        if (user) {
          setInitialRoute('Dashboard');
        }
      } catch (e) {
        // Ignored
      } finally {
        setIsReady(true);
      }
    }
    checkAuth();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Tracker" component={TrackerScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <MainNavigator />
    </ThemeProvider>
  );
}
