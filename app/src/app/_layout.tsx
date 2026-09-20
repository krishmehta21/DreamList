import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { BudgetProvider } from '@/context/BudgetContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '@/lib/database';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useShareIntent } from 'expo-share-intent';
import { CustomAlertModal } from '@/components/CustomAlert';

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Not signed in and not on login page → redirect to login
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Signed in but on login page → redirect to tabs
      router.replace('/');
    } else if (user && hasShareIntent && shareIntent) {
      // Process share intent if logged in
      const text = shareIntent.text || '';
      const webUrl = shareIntent.webUrl || '';
      
      // Extract URL from shared text using regex if needed
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const match = text.match(urlRegex) || webUrl.match(urlRegex);
      const extractedUrl = match ? match[0] : null;

      console.log('Share intent received in AuthGate:', { text, webUrl, extractedUrl });

      // Reset the share intent immediately so it doesn't trigger again on subsequent renders
      resetShareIntent();

      if (extractedUrl) {
        // Redirect to Add Item screen with sharedUrl parameter
        router.push({
          pathname: '/add',
          params: { sharedUrl: extractedUrl }
        });
      } else if (text.trim()) {
        // Redirect to Add Item screen with sharedText parameter (fallback for plain text)
        router.push({
          pathname: '/add',
          params: { sharedText: text.trim() }
        });
      }
    }

    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [user, loading, segments, hasShareIntent, shareIntent]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthGate>
            <BudgetProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#F0F4FC' },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen
                  name="login"
                  options={{
                    animation: 'fade',
                    contentStyle: { backgroundColor: '#3E42B8' },
                  }}
                />
                <Stack.Screen
                  name="(tabs)"
                  options={{
                    animation: 'fade',
                    contentStyle: { backgroundColor: '#F0F4FC' },
                  }}
                />
                <Stack.Screen
                  name="items/[id]"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: '#F0F4FC' },
                  }}
                />
                <Stack.Screen
                  name="add"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: '#F0F4FC' },
                  }}
                />
                <Stack.Screen
                  name="expenses/transaction"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: '#F0F4FC' },
                  }}
                />
                <Stack.Screen
                  name="expenses/categories"
                  options={{
                    presentation: 'card',
                    animation: 'slide_from_right',
                    contentStyle: { backgroundColor: '#F0F4FC' },
                  }}
                />
              </Stack>
              <CustomAlertModal />
            </BudgetProvider>
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

