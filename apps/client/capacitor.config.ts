import type { CapacitorConfig } from '@capacitor/cli';

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
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#0D0A10',
      showSpinner: false,
    },
  },
};

export default config;
