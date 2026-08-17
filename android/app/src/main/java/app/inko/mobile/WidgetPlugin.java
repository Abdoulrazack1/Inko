package app.inko.mobile;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Le pont qui alimente {@link WidgetReprise} (audit P3.5).
 *
 * La page pousse ce qu'elle lit ; le widget le peint. C'est tout — et c'est
 * délibérément asymétrique : le widget ne demande jamais rien, parce qu'il peut
 * être réveillé alors qu'aucune page n'existe pour lui répondre.
 *
 * ── Ce qui est stocké, et ce qui ne l'est pas ───────────────
 *
 * Trois chaînes : un titre, un sous-titre, un chemin. Pas de couverture — une
 * image demanderait de la télécharger, de la stocker, de la purger, et
 * d'accepter qu'elle soit visible sur l'écran d'accueil de quelqu'un qui prête
 * son téléphone. Le titre suffit à savoir où on en est.
 *
 * Le stockage est celui, PRIVÉ, de l'application : aucune autre application ne
 * peut le lire. Ça compte, parce que ce que quelqu'un lit en dit long.
 */
@CapacitorPlugin(name = "InkoWidget")
public class WidgetPlugin extends Plugin {

    /**
     * Enregistre la lecture en cours et repeint le widget.
     * Un titre vide REMET À ZÉRO — c'est ce qui doit arriver à la déconnexion,
     * sinon le widget continuerait d'afficher la série d'un compte quitté.
     */
    @PluginMethod
    public void majReprise(PluginCall call) {
        Context ctx = getContext();
        String titre = call.getString("titre", "");
        String sousTitre = call.getString("sousTitre", "");
        String lien = call.getString("lien", "");

        // Le lien vient du WebView, donc d'un endroit où une page peut se
        // tromper. On le range tel quel mais RaccourcisPlugin le revalidera
        // avant toute navigation : le contrôle est du côté qui agit, pas du
        // côté qui range.
        SharedPreferences.Editor e = ctx.getSharedPreferences(
                WidgetReprise.PREFS, Context.MODE_PRIVATE).edit();
        if (titre == null || titre.trim().isEmpty()) {
            e.remove(WidgetReprise.CLE_TITRE)
             .remove(WidgetReprise.CLE_SOUS_TITRE)
             .remove(WidgetReprise.CLE_LIEN);
        } else {
            // Bornes : un titre de roman peut être très long, et une
            // `RemoteViews` qui dépasse la taille de transaction Binder fait
            // disparaître le widget au lieu de le tronquer.
            e.putString(WidgetReprise.CLE_TITRE, couper(titre, 60))
             .putString(WidgetReprise.CLE_SOUS_TITRE, couper(sousTitre, 60))
             .putString(WidgetReprise.CLE_LIEN, couper(lien, 300));
        }
        e.apply();

        WidgetReprise.rafraichirTout(ctx);

        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    private static String couper(String s, int max) {
        if (s == null) return "";
        s = s.trim();
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
