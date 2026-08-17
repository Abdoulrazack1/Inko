package app.inko.mobile;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Queue;

/**
 * Découverte du hub sur le réseau local (audit VIII.44, P2.8).
 *
 * Un WebView ne peut pas faire de mDNS : ni socket brute, ni multicast. Il
 * faut donc passer par `NsdManager`, qui est DANS le framework Android — aucune
 * dépendance ajoutée pour ça.
 *
 * ── Ce que cette découverte ne fait pas ─────────────────────
 *
 * Elle ne choisit pas. Elle rapporte ce qu'elle a vu, avec l'identité que
 * chaque hub annonce, et c'est la PAGE qui décide — en comparant à l'identité
 * mémorisée lors de l'appairage. L'audit est explicite : se connecter au
 * premier service `_inko._tcp` trouvé reviendrait à faire confiance à
 * n'importe quelle machine du réseau.
 *
 * ── Le piège de `resolveService` ────────────────────────────
 *
 * Sur Android, `resolveService` ne supporte qu'UNE résolution à la fois.
 * Lancer la deuxième avant la fin de la première fait échouer les deux avec
 * `FAILURE_ALREADY_ACTIVE` — et c'est le cas normal, pas un cas limite : deux
 * hubs sur le réseau, ou simplement un service annoncé sur IPv4 et IPv6.
 * Les résolutions sont donc mises en FILE.
 */
@CapacitorPlugin(name = "InkoDecouverte")
public class DecouvertePlugin extends Plugin {

    private static final String TYPE = "_inko._tcp.";

    private NsdManager nsd;
    private NsdManager.DiscoveryListener ecouteur;

    // Clé = nom du service : le même hub est parfois annoncé deux fois (IPv4 et
    // IPv6). Deux lignes pour un seul PC dans la liste de choix seraient
    // incompréhensibles pour l'utilisateur.
    private final Map<String, JSObject> trouves = new LinkedHashMap<>();
    private final Queue<NsdServiceInfo> aResoudre = new ArrayDeque<>();
    private boolean resolutionEnCours = false;

    @PluginMethod
    public void chercher(PluginCall call) {
        int duree = call.getInt("dureeMs", 4000);
        // Borné : une découverte est un geste d'interface. Au-delà de dix
        // secondes, l'utilisateur a conclu que ça ne marche pas et il est parti
        // taper l'adresse à la main — laisser tourner la radio pour rien.
        duree = Math.max(1000, Math.min(10000, duree));

        Context ctx = getContext();
        nsd = (NsdManager) ctx.getSystemService(Context.NSD_SERVICE);
        if (nsd == null) {
            call.resolve(resultat(new JSArray(), "service de découverte indisponible"));
            return;
        }

        synchronized (trouves) { trouves.clear(); }
        aResoudre.clear();
        resolutionEnCours = false;

        ecouteur = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String type) { }

            @Override public void onServiceFound(NsdServiceInfo info) {
                if (info.getServiceType() == null || !info.getServiceType().contains("inko")) return;
                synchronized (aResoudre) {
                    aResoudre.add(info);
                }
                resoudreSuivant();
            }

            @Override public void onServiceLost(NsdServiceInfo info) {
                synchronized (trouves) { trouves.remove(info.getServiceName()); }
            }

            @Override public void onDiscoveryStopped(String type) { }
            @Override public void onStartDiscoveryFailed(String type, int code) { arreter(); }
            @Override public void onStopDiscoveryFailed(String type, int code) { arreter(); }
        };

        try {
            nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, ecouteur);
        } catch (Exception e) {
            call.resolve(resultat(new JSArray(), "découverte impossible : " + e.getMessage()));
            return;
        }

        // On rend la main après le délai, avec ce qu'on a. Rendre au premier
        // service trouvé serait plus rapide et FAUX : deux hubs sur le réseau
        // (un PC et un NAS) doivent tous deux apparaître, sinon l'utilisateur
        // ne peut pas choisir celui qu'il veut.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            arreter();
            JSArray liste = new JSArray();
            synchronized (trouves) {
                for (JSObject o : trouves.values()) liste.put(o);
            }
            call.resolve(resultat(liste, null));
        }, duree);
    }

    private JSObject resultat(JSArray hubs, String raison) {
        JSObject r = new JSObject();
        r.put("hubs", hubs);
        if (raison != null) r.put("raison", raison);
        return r;
    }

    /**
     * Une résolution à la fois. `resolveService` échoue avec
     * FAILURE_ALREADY_ACTIVE si on en lance une seconde avant la fin de la
     * première — et deux services découverts ensemble est le cas NORMAL.
     */
    private void resoudreSuivant() {
        NsdServiceInfo suivant;
        synchronized (aResoudre) {
            if (resolutionEnCours || aResoudre.isEmpty()) return;
            resolutionEnCours = true;
            suivant = aResoudre.poll();
        }
        if (suivant == null) { resolutionEnCours = false; return; }

        nsd.resolveService(suivant, new NsdManager.ResolveListener() {
            @Override public void onResolveFailed(NsdServiceInfo info, int code) {
                resolutionEnCours = false;
                resoudreSuivant();
            }

            @Override public void onServiceResolved(NsdServiceInfo info) {
                try {
                    JSObject o = new JSObject();
                    o.put("nom", info.getServiceName());
                    String hote = info.getHost() != null ? info.getHost().getHostAddress() : null;
                    o.put("hote", hote);
                    o.put("port", info.getPort());
                    if (hote != null) {
                        // L'adresse littérale IPv6 doit être encadrée, sinon
                        // l'URL est invalide : http://[fe80::1]:8088 (VIII.44).
                        String hoteUrl = hote.contains(":") ? "[" + hote + "]" : hote;
                        o.put("url", "http://" + hoteUrl + ":" + info.getPort());
                    }
                    // L'identité annoncée. C'est LE champ qui compte : sans
                    // lui, la page ne peut pas savoir si ce hub est le sien.
                    Map<String, byte[]> txt = info.getAttributes();
                    if (txt != null) {
                        byte[] hub = txt.get("hub");
                        byte[] v = txt.get("v");
                        if (hub != null) o.put("hubId", new String(hub, StandardCharsets.UTF_8));
                        if (v != null) o.put("versionAnnonce", new String(v, StandardCharsets.UTF_8));
                    }
                    synchronized (trouves) { trouves.put(info.getServiceName(), o); }
                } catch (Exception ignore) {
                    // Un service mal formé ne doit pas faire tomber la
                    // découverte des autres.
                } finally {
                    resolutionEnCours = false;
                    resoudreSuivant();
                }
            }
        });
    }

    private void arreter() {
        if (nsd != null && ecouteur != null) {
            try { nsd.stopServiceDiscovery(ecouteur); } catch (Exception ignore) { }
        }
        ecouteur = null;
    }

    /**
     * La découverte tient la radio et le multicast. La laisser tourner pendant
     * que l'application est en arrière-plan viderait la batterie pour un
     * résultat que personne ne regarde.
     */
    @Override
    public void handleOnPause() {
        arreter();
    }
}
