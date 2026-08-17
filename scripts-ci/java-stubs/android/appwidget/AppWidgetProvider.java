package android.appwidget;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class AppWidgetProvider extends BroadcastReceiver {
    // Le vrai AppWidgetProvider IMPLEMENTE onReceive et repartit vers
    // onUpdate/onDeleted/... : sans ca, une sous-classe heriterait d'une
    // methode abstraite et ne compilerait pas.
    public void onReceive(Context context, Intent intent) {}
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {}
    public void onEnabled(Context context) {}
    public void onDisabled(Context context) {}
    public void onDeleted(Context context, int[] appWidgetIds) {}
}
