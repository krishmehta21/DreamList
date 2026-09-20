import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const NOTIF_ENABLED_KEY = 'dreamlist_expense_reminders_enabled';
const NIGHTLY_NOTIF_ID = 'dreamlist_nightly_reminder';
const MIDDAY_NOTIF_ID = 'dreamlist_midday_reminder';

// Determine whether we are running inside the standard Expo Go client
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

// Lazily load expo-notifications only if NOT in Expo Go (Expo Go SDK 53+ blocks native notifications on Android)
let Notifications: any = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('expo-notifications could not be loaded:', err);
    Notifications = null;
  }
}

/**
 * Check if native notification scheduling is supported in current environment
 */
export function isNativeNotificationSupported(): boolean {
  return !isExpoGo && Notifications !== null;
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNativeNotificationSupported()) {
    return true; // Virtual permission for Expo Go in-app reminders
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('expense-reminders', {
        name: 'Expense Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Failed to request notification permissions:', err);
    return false;
  }
}

/**
 * Schedule daily expense tracking reminders (e.g. 1:30 PM and 9:00 PM)
 */
export async function scheduleDailyReminders(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true');

    if (!isNativeNotificationSupported()) {
      // In Expo Go: Record preference; native background scheduling is reserved for development builds
      return true;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) return false;

    // Cancel existing scheduled reminders first
    await cancelDailyReminders();

    // 1. Midday Reminder (13:30 / 1:30 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: MIDDAY_NOTIF_ID,
      content: {
        title: '☕ Lunch or Coffee Spends?',
        body: 'Take 5 seconds to log your midday expenses in DreamList to protect your Safe Spend.',
        data: { screen: 'expenses' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 13,
        minute: 30,
      },
    });

    // 2. Nightly Recap Reminder (21:00 / 9:00 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: NIGHTLY_NOTIF_ID,
      content: {
        title: '🌙 Daily Cashflow Check-in',
        body: 'Keep your reservoir accurate! Log any unrecorded spends before closing out today.',
        data: { screen: 'expenses' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });

    return true;
  } catch (err) {
    console.error('Failed to schedule daily reminders:', err);
    return false;
  }
}

/**
 * Cancel all daily reminders
 */
export async function cancelDailyReminders(): Promise<void> {
  try {
    if (isNativeNotificationSupported()) {
      await Notifications.cancelScheduledNotificationAsync(MIDDAY_NOTIF_ID);
      await Notifications.cancelScheduledNotificationAsync(NIGHTLY_NOTIF_ID);
    }
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'false');
  } catch (err) {
    console.warn('Error cancelling reminders:', err);
  }
}

/**
 * Get whether reminders are currently enabled
 */
export async function getRemindersEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Trigger an immediate test notification so user can see it works
 */
export async function triggerTestNotification(): Promise<boolean> {
  try {
    if (!isNativeNotificationSupported()) {
      Alert.alert(
        '🔔 DreamList Expense Tracker',
        'Daily reminders active (1:30 PM & 9:00 PM).\n\n(Note: In Expo Go, notifications run in-app. In production or development builds, these fire as native system notifications).'
      );
      return true;
    }

    const granted = await requestNotificationPermissions();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✨ DreamList Expense Tracker',
        body: 'Reminders are active! We will nudge you at 1:30 PM and 9:00 PM to log daily expenses.',
        sound: true,
      },
      trigger: null, // send immediately
    });
    return true;
  } catch (err) {
    console.error('Failed to trigger test notification:', err);
    return false;
  }
}
