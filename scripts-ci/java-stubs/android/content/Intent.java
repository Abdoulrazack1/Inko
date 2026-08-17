package android.content;
public class Intent {
    public static final int FLAG_ACTIVITY_NEW_TASK = 268435456, FLAG_ACTIVITY_CLEAR_TOP = 67108864;
    public static final String ACTION_SEND = "android.intent.action.SEND";
    public static final String EXTRA_TEXT = "android.intent.extra.TEXT";
    public String getAction() { return null; }
    public Intent() {}
    public Intent(Context packageContext, Class<?> cls) {}
    public String getStringExtra(String name) { return null; }
    public Intent putExtra(String name, String value) { return this; }
    public Intent setFlags(int flags) { return this; }
}
