package androidx.work;
import android.content.Context;
public abstract class Worker extends ListenableWorker {
    public Worker(Context appContext, WorkerParameters params) { super(appContext, params); }
    public abstract Result doWork();
}
