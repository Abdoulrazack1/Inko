package androidx.work;
import android.content.Context;
public abstract class ListenableWorker {
    public ListenableWorker(Context appContext, WorkerParameters params) {}
    public Context getApplicationContext() { return null; }
    public static abstract class Result {
        public static Result success() { return null; }
        public static Result retry() { return null; }
        public static Result failure() { return null; }
    }
}
