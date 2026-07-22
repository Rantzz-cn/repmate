package app.repmate.mobile;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RepMateWidget")
public class RepMateWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "RepMate");
        String subtitle = call.getString("subtitle", "Your next session is ready.");
        String action = call.getString("action", "Open RepMate");
        SharedPreferences preferences = getContext().getSharedPreferences(TodayWorkoutWidget.PREFERENCES, Context.MODE_PRIVATE);
        preferences.edit().putString("title", title).putString("subtitle", subtitle).putString("action", action).apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        ComponentName component = new ComponentName(getContext(), TodayWorkoutWidget.class);
        int[] ids = manager.getAppWidgetIds(component);
        Intent updateIntent = new Intent(getContext(), TodayWorkoutWidget.class);
        updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        getContext().sendBroadcast(updateIntent);

        call.resolve(new JSObject());
    }
}
