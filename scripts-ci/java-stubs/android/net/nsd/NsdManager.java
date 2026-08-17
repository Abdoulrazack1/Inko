package android.net.nsd;
public class NsdManager {
    public static final int PROTOCOL_DNS_SD = 1;
    public interface DiscoveryListener {
        void onDiscoveryStarted(String serviceType);
        void onServiceFound(NsdServiceInfo serviceInfo);
        void onServiceLost(NsdServiceInfo serviceInfo);
        void onDiscoveryStopped(String serviceType);
        void onStartDiscoveryFailed(String serviceType, int errorCode);
        void onStopDiscoveryFailed(String serviceType, int errorCode);
    }
    public interface ResolveListener {
        void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode);
        void onServiceResolved(NsdServiceInfo serviceInfo);
    }
    public void discoverServices(String serviceType, int protocolType, DiscoveryListener listener) {}
    public void stopServiceDiscovery(DiscoveryListener listener) {}
    public void resolveService(NsdServiceInfo serviceInfo, ResolveListener listener) {}
}
