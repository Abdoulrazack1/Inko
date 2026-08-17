package com.getcapacitor;
import org.json.JSONObject;
// Les six surcharges de la classe RÉELLE (JSObject.java:115-159) : elles
// avalent JSONException, contrairement à JSONObject. En omettre une ferait
// remonter une exception vérifiée que le vrai code n'a pas — un faux échec.
public class JSObject extends JSONObject {
    @Override public JSObject put(String key, boolean value) { return this; }
    @Override public JSObject put(String key, int value) { return this; }
    @Override public JSObject put(String key, long value) { return this; }
    @Override public JSObject put(String key, double value) { return this; }
    @Override public JSObject put(String key, Object value) { return this; }
    public JSObject put(String key, String value) { return this; }
}
