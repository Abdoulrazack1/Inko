package app.inko.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

/**
 * Pilote la veille de nouveaux chapitres — la variante SANS Firebase.
 *
 * La page connaît l'adresse du hub et le jeton d'appareil ; le travailleur en
 * arrière-plan, non — il tourne quand l'application est fermée, sans WebView,
 * sans `localStorage`. Ce greffon fait le passage : la page dépose, Java lit.
 *
 * ── Le jeton est rangé où, exactement ───────────────────────
 *
 * Dans les `SharedPreferences` privées de l'application : lisibles par elle
 * seule, effacées à la désinstallation, et exclues des sauvegardes
 * (`allowBackup=false` — un jeton restauré sur un AUTRE téléphone serait un
 * défaut de sécurité, et c'est déjà la position tenue pour l'appairage).
 *
 * ── Quinze minutes, et pas moins ────────────────────────────
 *
 * C'est le minimum imposé par `WorkManager`. Le demander plus court ne le rend
 * pas plus court : Android l'aligne en silence. Autant l'écrire honnêtement.
 * Et c'est amplement suffisant — un chapitre n'est pas une urgence, et un
 * réveil toutes les cinq minutes se paierait en batterie pour une information
 * qui peut attendre.
 */
@CapacitorPlugin(name = "InkoVeille")
public class VeillePlugin extends Plugin {

    private static final String TRAVAIL = "inko-veille-chapitres";

    @PluginMethod
    public void configurer(PluginCall call) {
        String url = call.getString("url", null);
        String jeton = call.getString("jeton", null);
        if (url == null || jeton == null) {
            call.reject("url et jeton requis");
            return;
        }
        Context ctx = getContext();
        SharedPreferences p = ctx.getSharedPreferences(VeilleWorker.PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor e = p.edit()
                .putString(VeilleWorker.CLE_URL, url.replaceAll("/+$", ""))
                .putString(VeilleWorker.CLE_JETON, jeton);

        // Le repère de dernière notification vue n'est posé QU'À LA PREMIÈRE
        // configuration. Le réinitialiser à chaque appel ferait rejaillir tout
        // l'historique en notifications dès qu'on rouvre les réglages.
        if (!p.contains(VeilleWorker.CLE_DERNIER)) {
            // On part de « rien de neuf » plutôt que de zéro : au premier
            // branchement, l'utilisateur ne veut pas recevoir les trente
            // notifications déjà lues sur le PC.
            e.putInt(VeilleWorker.CLE_DERNIER, call.getInt("depuisId", 0));
        }
        e.apply();

        Constraints c = new Constraints.Builder()
                // Sans réseau, ce travail ne peut rien faire : le laisser
                // s'exécuter quand même réveillerait le téléphone pour échouer.
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(
                VeilleWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(c)
                .build();

        // KEEP et non REPLACE : rouvrir les réglages ne doit pas remettre le
        // compteur de période à zéro. Avec REPLACE, quelqu'un qui consulte ses
        // réglages tous les quarts d'heure ne recevrait JAMAIS de notification,
        // le travail repartant de zéro à chaque fois.
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                TRAVAIL, ExistingPeriodicWorkPolicy.KEEP, r);

        JSObject o = new JSObject();
        o.put("actif", true);
        o.put("intervalleMinutes", 15);
        call.resolve(o);
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        Context ctx = getContext();
        WorkManager.getInstance(ctx).cancelUniqueWork(TRAVAIL);
        // Le jeton part avec : garder un jeton d'appareil pour un service
        // désactivé n'a aucune utilité, et tout secret conservé sans raison est
        // un secret de trop.
        ctx.getSharedPreferences(VeilleWorker.PREFS, Context.MODE_PRIVATE)
                .edit().remove(VeilleWorker.CLE_JETON).apply();
        call.resolve();
    }

    @PluginMethod
    public void etat(PluginCall call) {
        SharedPreferences p = getContext()
                .getSharedPreferences(VeilleWorker.PREFS, Context.MODE_PRIVATE);
        JSObject o = new JSObject();
        o.put("configure", p.getString(VeilleWorker.CLE_JETON, null) != null);
        o.put("dernierId", p.getInt(VeilleWorker.CLE_DERNIER, 0));
        call.resolve(o);
    }
}
