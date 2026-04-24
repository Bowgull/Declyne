---
name: declyne-ios
description: Capacitor 8 iOS wrapper config. Sideload only. No Badge plugin. Two reconciliation notifications.
---

# Declyne iOS Skill

Capacitor 8. Sideload via Xcode to Josh's device. No App Store, no TestFlight, no provisioning profile renewals beyond personal developer account.

## Capacitor Config

```ts
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.josh.declyne',
  appName: 'Declyne',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0D0A10',
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#6B5A9E',
    },
    FilePicker: {},
  },
};
```

No `Badge` plugin. No `PushNotifications` plugin. No remote notifications at all.

## Required Plugins

- `@capacitor/local-notifications` for the two weekly reminders
- `@capawesome/capacitor-file-picker` for CSV import (iOS Files app)
- `@capacitor/filesystem` for CSV export save
- `@capacitor/share` for export share sheet
- `@capacitor/status-bar` for dark status bar
- `@capacitor/splash-screen` for cold start

## Notifications

Two scheduled local notifications, repeating weekly:

```ts
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
```

Weekday 1 = Sunday, 3 = Tuesday in Capacitor's schema. Verify at build time. Cancel and reschedule if Josh completes reconciliation early (Tuesday cancels if Sunday completed).

## Safe Area

Use CSS env() everywhere:

```css
.app-shell {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

Four-tab bar anchors to `env(safe-area-inset-bottom)` with a 56px content height above it.

## File Picker (CSV import)

```ts
const result = await FilePicker.pickFiles({
  types: ['text/csv', 'text/comma-separated-values'],
  multiple: true,
});
```

Read contents via `@capacitor/filesystem` if the picker returns a path, or via the returned blob on web. Parse in a Web Worker with PapaParse.

## Wrangler (for the Worker the app talks to)

```toml
# wrangler.toml
name = "declyne-api"
main = "src/worker.ts"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "declyne"
database_id = "TBD-on-create"

[vars]
ENVIRONMENT = "production"

# Secrets set via: wrangler secret put OPENAI_API_KEY
# OPENAI_API_KEY, TWELVE_DATA_KEY, FMP_KEY
```

## Build Commands

- Dev web: `pnpm dev`
- Build web: `pnpm build`
- Sync iOS: `pnpm cap sync ios`
- Open Xcode: `pnpm cap open ios`
- Deploy Worker: `pnpm wrangler deploy`
- D1 migrate: `pnpm drizzle-kit push`

## App Icon

1024x1024 master. Mascot PNG centered at 55%, `#0D0A10` background, 4% grain overlay baked in. Generated sizes via `@capacitor/assets` or manual export to `ios/App/App/Assets.xcassets/AppIcon.appiconset`.

## Splash

Solid `#0D0A10`. No mascot. Short duration (under 800ms). Status bar dark from cold start.
