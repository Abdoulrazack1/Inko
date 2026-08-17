package android.appwidget;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
public class AppWidgetManager {
    public static AppWidgetManager getInstance(Context context) { return null; }
    public int[] getAppWidgetIds(ComponentName provider) { return null; }
    public void updateAppWidget(int appWidgetId, RemoteViews views) {}
    public void updateAppWidget(int[] appWidgetIds, RemoteViews views) {}
}
