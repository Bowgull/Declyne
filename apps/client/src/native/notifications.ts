import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Two scheduled local notifications:
//   1 = Sunday 9am reconciliation
//   2 = Tuesday 9am follow-up (cancelled if Sunday was completed)
export async function scheduleAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== 'granted') return;
  }

  // Clear prior schedule to avoid piling duplicates on reinstall.
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    // fresh install
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: 'Sunday reconciliation',
        body: 'Receipts are waiting. Ten minutes.',
        schedule: { on: { weekday: 1, hour: 9, minute: 0 }, repeats: true },
      },
      {
        id: 2,
        title: 'You skipped Sunday',
        body: 'Last soft reminder before the week runs away.',
        schedule: { on: { weekday: 3, hour: 9, minute: 0 }, repeats: true },
      },
    ],
  });
}

// Called when Sunday reconciliation is completed — cancel the Tuesday pester.
export async function dismissFollowUpThisWeek(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 2 }] });
  } catch {
    // no-op
  }
  // Next Sunday the repeating schedule re-arms naturally; re-add the Tuesday one.
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 2,
        title: 'You skipped Sunday',
        body: 'Last soft reminder before the week runs away.',
        schedule: { on: { weekday: 3, hour: 9, minute: 0 }, repeats: true },
      },
    ],
  });
}
