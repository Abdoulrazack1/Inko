package androidx.appcompat.app;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
public class AppCompatActivity extends Context {
    protected void onCreate(Bundle savedInstanceState) {}
    protected void onNewIntent(Intent intent) {}
    public boolean dispatchKeyEvent(android.view.KeyEvent event) { return false; }
    public Intent getIntent() { return null; }
}
