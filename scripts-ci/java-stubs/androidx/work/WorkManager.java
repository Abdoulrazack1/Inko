package androidx.work;
import android.content.Context;
public abstract class WorkManager {
    public static WorkManager getInstance(Context ctx) { return null; }
    public abstract void enqueueUniquePeriodicWork(String name, ExistingPeriodicWorkPolicy policy, PeriodicWorkRequest work);
    public abstract void cancelUniqueWork(String name);
}
