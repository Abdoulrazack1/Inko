package org.json;
public class JSONObject {
    public JSONObject() {}
    public JSONObject(String source) throws JSONException {}
    public JSONObject put(String k, Object v) throws JSONException { return this; }
    public JSONObject put(String k, boolean v) throws JSONException { return this; }
    public JSONObject put(String k, int v) throws JSONException { return this; }
    public JSONObject put(String k, long v) throws JSONException { return this; }
    public JSONObject put(String k, double v) throws JSONException { return this; }
    public JSONArray optJSONArray(String name) { return null; }
    public JSONObject optJSONObject(String name) { return null; }
    public String optString(String name, String fallback) { return fallback; }
    public int optInt(String name, int fallback) { return fallback; }
}
