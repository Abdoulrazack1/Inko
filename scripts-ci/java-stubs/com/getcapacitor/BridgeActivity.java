package com.getcapacitor;
import android.content.Intent;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
public class BridgeActivity extends AppCompatActivity {
    protected Bridge bridge;
    @Override protected void onCreate(Bundle savedInstanceState) {}
    @Override protected void onNewIntent(Intent intent) {}
    public void registerPlugin(Class<? extends Plugin> plugin) {}
    public Bridge getBridge() { return this.bridge; }
}
