package android.content;
public interface SharedPreferences {
    String getString(String key, String defValue);
    int getInt(String key, int defValue);
    boolean contains(String key);
    Editor edit();
    interface Editor {
        Editor putString(String key, String value);
        Editor putInt(String key, int value);
        Editor remove(String key);
        void apply();
    }
}
