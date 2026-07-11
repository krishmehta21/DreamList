import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '@/lib/database';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Not signed in and not on login page → redirect to login
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Signed in but on login page → redirect to tabs
      router.replace('/');
    }

    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [user, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  const CustomDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0B0D10',
      card: '#121519',
      border: '#1C2026',
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={CustomDarkTheme}>
          <AuthProvider>
            <StatusBar style="light" />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#0B0D10' },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen
                  name="login"
                  options={{
                    animation: 'fade',
                    contentStyle: { backgroundColor: '#0B0D10' },
                  }}
                />
                <Stack.Screen
                  name="(tabs)"
                  options={{
                    animation: 'fade',
                    contentStyle: { backgroundColor: '#0B0D10' },
                  }}
                />
                <Stack.Screen
                  name="items/[id]"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: '#0B0D10' },
                  }}
                />
                <Stack.Screen
                  name="add"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: '#0B0D10' },
                  }}
                />
                <Stack.Screen
                  name="expenses/transaction"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: '#0B0D10' },
                  }}
                />
                <Stack.Screen
                  name="expenses/categories"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: '#0B0D10' },
                  }}
                />
              </Stack>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

