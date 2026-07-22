import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.repmate.mobile",
  appName: "RepMate",
  webDir: "out",
  backgroundColor: "#050505",
  android: {
    allowMixedContent: false,
  },
};

export default config;
