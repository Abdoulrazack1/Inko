package android.widget;
import android.app.PendingIntent;
public class RemoteViews {
    public RemoteViews(String packageName, int layoutId) {}
    public void setTextViewText(int viewId, CharSequence text) {}
    public void setViewVisibility(int viewId, int visibility) {}
    public void setOnClickPendingIntent(int viewId, PendingIntent pendingIntent) {}
    public void setImageViewResource(int viewId, int srcId) {}
}
