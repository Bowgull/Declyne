import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SIDELOAD_REMINDER_DAYS } from '@declyne/shared';

const BUILD_STAMP_KEY = 'declyne.sideload.installedAt';

// Three scheduled local notifications:
//   1 = Sunday 9am reconciliation
//   2 = Tuesday 9am follow-up (cancelled if Sunday was completed)
//   3 = Day 6 10am "redeploy before the free profile expires"
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

  const sideloadAt = await getOrStampSideloadDate();
  const redeployAt = new Date(sideloadAt.getTime() + SIDELOAD_REMINDER_DAYS * 86_400_000);
  redeployAt.setHours(10, 0, 0, 0);

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
      {
        id: 3,
        title: 'Redeploy Declyne',
        body: 'Free provisioning expires tomorrow. Plug in, open Xcode, hit run.',
        schedule: { at: redeployAt, allowWhileIdle: true },
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

async function getOrStampSideloadDate(): Promise<Date> {
  const stored = localStorage.getItem(BUILD_STAMP_KEY);
  if (stored) {
    const d = new Date(stored);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const now = new Date();
  localStorage.setItem(BUILD_STAMP_KEY, now.toISOString());
  return now;
}
