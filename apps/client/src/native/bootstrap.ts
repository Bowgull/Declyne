import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { scheduleAllNotifications, syncDynamicNotifications } from './notifications';

export async function bootstrapNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0D0A10' });
  } catch {
    // non-iOS or older iOS
  }

  await scheduleAllNotifications();
  // Best-effort: dynamic schedule depends on token + reachable worker.
  syncDynamicNotifications().catch(() => {});
  await SplashScreen.hide();
}
