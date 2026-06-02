import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SocketProvider } from '@/contexts/SocketContext';

import NotificationManager from '@/components/NotificationManager';

import CallManager from '@/components/call/CallManager';
import GroupCallManager from '@/components/call/GroupCallManager';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;
    
    const checkAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (!isMounted) return;

        const inAuthGroup = [
          'welcome', 'login', 'register', 'register-otp', 
          'register-name', 'register-info', 'register-avatar', 'forgot-password'
        ].includes(segments[0] as string);

        if (!token && !inAuthGroup) {
          // If no token and not trying to access an auth screen, redirect to welcome
          router.replace('/welcome');
        } else if (token && inAuthGroup) {
          // If token exists and trying to access auth screen, redirect to main app
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.log('Error checking auth state:', error);
      } finally {
        if (isMounted) {
          await SplashScreen.hideAsync();
        }
      }
    };

    const timeout = setTimeout(() => {
      checkAuthStatus();
    }, 10);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SocketProvider>
        <NotificationManager />
        <Stack>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="register-otp" options={{ headerShown: false }} />
          <Stack.Screen name="register-name" options={{ headerShown: false }} />
          <Stack.Screen name="register-info" options={{ headerShown: false }} />
          <Stack.Screen name="register-avatar" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="qr-scanner" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="join/[inviteCode]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
        <CallManager />
        <GroupCallManager />
      </SocketProvider>
    </ThemeProvider>
  );
}
