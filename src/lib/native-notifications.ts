import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const REST_NOTIFICATION_ID = 41001;

export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) {
    if (!("Notification" in window)) return false;
    return (Notification.permission === "granted" ? "granted" : await Notification.requestPermission()) === "granted";
  }
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  return (await LocalNotifications.requestPermissions()).display === "granted";
}

export async function scheduleRestNotification(seconds: number, exerciseName: string) {
  if (!Capacitor.isNativePlatform() || seconds <= 0) return;
  if (!(await requestNotificationPermission())) return;
  await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: REST_NOTIFICATION_ID,
      title: "Rest complete",
      body: `${exerciseName}: your next set is ready.`,
      schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
      channelId: "rest-timers",
      extra: { route: "/app/workout" },
    }],
  });
}

export async function cancelRestNotification() {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
}

export async function configureNotificationChannels() {
  if (Capacitor.getPlatform() !== "android") return;
  await LocalNotifications.createChannel({
    id: "rest-timers",
    name: "Rest timers",
    description: "Alerts when a workout rest period ends.",
    importance: 4,
    visibility: 1,
    vibration: true,
  });
}
