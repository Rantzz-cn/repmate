import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.repmate.mobile",
  appName: "RepMate",
  webDir: "out",
  backgroundColor: "#050505",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_repmate",
      iconColor: "#FFFFFF",
    },
  },
};

export default config;
