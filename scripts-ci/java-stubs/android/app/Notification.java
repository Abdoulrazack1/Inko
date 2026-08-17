package android.app;
import android.content.Context;
public class Notification {
    public static class Builder {
        public Builder(Context ctx, String channelId) {}
        public Builder(Context ctx) {}
        public Builder setContentTitle(CharSequence t) { return this; }
        public Builder setContentText(CharSequence t) { return this; }
        public Builder setSmallIcon(int icon) { return this; }
        public Builder setAutoCancel(boolean b) { return this; }
        public Builder setContentIntent(PendingIntent pi) { return this; }
        public Notification build() { return new Notification(); }
    }
}
