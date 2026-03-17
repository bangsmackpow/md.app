import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.builtnetworks.mdapp',
  appName: 'md-app',
  webDir: 'out',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#09090b', // zinc-950
    },
  },
};

export default config;