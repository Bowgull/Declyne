import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../lib/api';

type DynamicNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  fire_date: string; // YYYY-MM-DD
};

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
        title: 'I kept the receipts.',
        body: 'All week. Every one. Sit down with me.',
        schedule: { on: { weekday: 1, hour: 9, minute: 0 }, repeats: true },
      },
      {
        id: 2,
        title: "Still pretending Sunday didn't happen?",
        body: "I'll wait. The numbers won't.",
        schedule: { on: { weekday: 3, hour: 9, minute: 0 }, repeats: true },
      },
    ],
  });
}

// Pulls dynamic notifications from the worker (bills due, paycheque,
// debt minimums, tank-low) and schedules each at 9am local on its fire_date.
// Call after scheduleAllNotifications on launch and after CSV import.
export async function syncDynamicNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  let payload: { notifications: DynamicNotification[] };
  try {
    payload = await api.get<{ notifications: DynamicNotification[] }>(
      '/api/notifications/schedule',
    );
  } catch {
    return;
  }
  const fresh = payload.notifications ?? [];
  // Cancel the dynamic id ranges only — never cancel the weekly receipts (1, 2).
  const dynamicIds: number[] = [];
  for (let i = 100; i < 150; i++) dynamicIds.push(i);
  for (let i = 200; i < 250; i++) dynamicIds.push(i);
  dynamicIds.push(300, 400);
  try {
    await LocalNotifications.cancel({ notifications: dynamicIds.map((id) => ({ id })) });
  } catch {
    // no pending in those ids
  }
  if (fresh.length === 0) return;
  await LocalNotifications.schedule({
    notifications: fresh.map((n) => {
      const parts = n.fire_date.split('-').map(Number);
      const y = parts[0] ?? new Date().getFullYear();
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      const at = new Date();
      at.setFullYear(y, m - 1, d);
      at.setHours(9, 0, 0, 0);
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at },
      };
    }),
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
        title: "Still pretending Sunday didn't happen?",
        body: "I'll wait. The numbers won't.",
        schedule: { on: { weekday: 3, hour: 9, minute: 0 }, repeats: true },
      },
    ],
  });
}
