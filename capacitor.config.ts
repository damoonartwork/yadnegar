import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.yadnegar.app",
  appName: "یادنگار",
  webDir: "dist",
  backgroundColor: "#0a0a0a",
  android: {
    // در اندروید ۱۵ به بعد، محتوا زیر نوار وضعیت و نوار ناوبری نرود
    adjustMarginsForEdgeToEdge: "force",
    backgroundColor: "#0a0a0a",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_yadnegar",
      iconColor: "#FFFFFF",
    },
  },
};

export default config;
