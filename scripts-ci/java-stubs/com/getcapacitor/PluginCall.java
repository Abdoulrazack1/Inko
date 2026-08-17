package com.getcapacitor;
public class PluginCall {
    public Boolean getBoolean(String name, Boolean defaultValue) { return defaultValue; }
    public Integer getInt(String name, Integer defaultValue) { return defaultValue; }
    public String getString(String name) { return null; }
    public String getString(String name, String defaultValue) { return defaultValue; }
    public void reject(String msg) {}
    public void resolve(JSObject data) {}
    public void resolve() {}
}
