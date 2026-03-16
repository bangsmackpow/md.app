import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.builtnetworks.mdapp',
  appName: 'md-app',
  webDir: 'out', // <--- Add this comma here
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#18181b',
    },
  },
};

export default config;