import { Capacitor, registerPlugin } from "@capacitor/core";

interface WidgetPayload {
  title: string;
  subtitle: string;
  action: string;
}

interface RepMateWidgetPlugin {
  update(options: WidgetPayload): Promise<void>;
}

const RepMateWidget = registerPlugin<RepMateWidgetPlugin>("RepMateWidget");

export async function updateTodayWidget(payload: WidgetPayload) {
  if (Capacitor.getPlatform() !== "android") return;
  await RepMateWidget.update(payload);
}
